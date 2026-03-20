import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { SendNotificationDto, NotificationChannel } from './dto/send-notification.dto';
import { NotificationLog, NotificationLogStatus } from './entities/notification-log.entity'; 
import { ScheduledNotification } from './entities/scheduled-notification.entity';
import { ScheduledNotificationStatus } from './entities/scheduled-notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectRepository(NotificationLog) 
    private notificationLogsRepository: Repository<NotificationLog>,
    @InjectRepository(ScheduledNotification)
    private scheduledRepository: Repository<ScheduledNotification>,
  ) {}

  async enqueueNotification(dto: SendNotificationDto): Promise<any> {
    this.logger.log(`📨 Encolando notificación para: ${dto.recipient}`);
    
    let delay = 0;
    let isScheduled = false;
    let scheduledId: string | undefined;

    if (dto.scheduling?.is_scheduled && dto.scheduling.send_at) {
      const scheduledTime = new Date(dto.scheduling.send_at);
      const now = new Date();
      
      if (scheduledTime <= now) {
        throw new Error('La fecha programada debe ser futura');
      }
      
      delay = scheduledTime.getTime() - now.getTime();
      isScheduled = true;
      
      if (delay > 30 * 24 * 60 * 60 * 1000) {
        throw new Error('La programación no puede exceder 30 días');
      }
      
      this.logger.log(`⏰ Programado para: ${scheduledTime.toLocaleString()}`);
    }

    // Si es programado, guardar en base de datos
    if (isScheduled) {
      // 🔥 SOLO usar los campos que existen en la entidad
      const scheduledData = {
        companyId: dto.companyId,
        templateId: dto.templateId || '',
        channel: dto.channel,
        recipient: dto.recipient,
        variables: dto.variables || null,
        scheduledAt: new Date(dto.scheduling!.send_at!),
        status: ScheduledNotificationStatus.SCHEDULED,
        // NOTA: No incluimos content, subject, attachments porque NO existen en la entidad
      };
      
      const scheduled = this.scheduledRepository.create(scheduledData);
      const saved = await this.scheduledRepository.save(scheduled);
      scheduledId = saved.id;
    }

    const job = await this.notificationsQueue.add(
      'send-notification',
      dto,
      {
        delay: delay > 0 ? delay : 0,
        attempts: parseInt(process.env.QUEUE_ATTEMPTS || '3'),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '2000'),
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      }
    );

    // Si es programado, actualizar el jobId (si existiera en la entidad)
    // NOTA: jobId NO existe en la entidad según tu estructura, así que NO actualizamos

    return {
      success: true,
      jobId: job.id,
      data: {
        id: scheduledId,
        jobId: job.id,
        recipient: dto.recipient,
        channel: dto.channel,
        companyId: dto.companyId,
        status: delay > 0 ? 'scheduled' : 'queued',
        scheduledAt: delay > 0 ? new Date(Date.now() + delay).toISOString() : undefined,
        hasAttachments: !!(dto.attachments && dto.attachments.length > 0),
      },
      timestamp: new Date().toISOString(),
      queue: 'notifications',
    };
  }

  async getStats(companyId: string) {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.notificationsQueue.getWaitingCount(),
        this.notificationsQueue.getActiveCount(),
        this.notificationsQueue.getCompletedCount(),
        this.notificationsQueue.getFailedCount(),
        this.notificationsQueue.getDelayedCount(),
      ]);

      // Contar programados en BD
      const scheduledCount = await this.scheduledRepository.count({
        where: { 
          companyId,
          status: ScheduledNotificationStatus.SCHEDULED 
        }
      });

      return {
        success: true,
        companyId,
        queueStats: {
          waiting,
          active,
          completed,
          failed,
          delayed,
          scheduled: scheduledCount,
          total: waiting + active + completed + failed + delayed,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error obteniendo stats:', error);
      throw error;
    }
  }

  async getLogs(companyId: string, limit: number = 50, offset: number = 0) {
    try {
      const [logs, total] = await this.notificationLogsRepository.findAndCount({
        where: { companyId },
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });

      return {
        success: true,
        data: logs,
        total,
        limit,
        offset,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error obteniendo logs:', error);
      throw error;
    }
  }

  async getScheduledNotifications(companyId: string, limit: number = 50, offset: number = 0) {
    try {
      const [scheduled, total] = await this.scheduledRepository.findAndCount({
        where: { companyId },
        order: { scheduledAt: 'ASC' },
        take: limit,
        skip: offset,
      });

      return {
        success: true,
        data: scheduled.map(s => ({
          id: s.id,
          recipient: s.recipient,
          companyId: s.companyId,
          templateId: s.templateId,
          channel: s.channel,
          variables: s.variables,
          scheduledAt: s.scheduledAt.toISOString(),
          status: s.status,
          // NOTA: createdAt NO existe en la entidad
        })),
        count: total,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error obteniendo notificaciones programadas:', error);
      throw error;
    }
  }

  async cancelScheduledNotification(companyId: string, id: string) {
    try {
      const scheduled = await this.scheduledRepository.findOne({
        where: { id, companyId },
      });

      if (!scheduled) {
        throw new NotFoundException('Notificación programada no encontrada');
      }

      if (scheduled.status !== ScheduledNotificationStatus.SCHEDULED) {
        throw new BadRequestException(`No se puede cancelar una notificación en estado ${scheduled.status}`);
      }

      // NOTA: No podemos remover de la cola porque jobId no existe en la entidad
      // Simplemente actualizamos el estado

      scheduled.status = ScheduledNotificationStatus.CANCELLED;
      await this.scheduledRepository.save(scheduled);

      return {
        success: true,
        message: 'Notificación cancelada correctamente',
        data: {
          id: scheduled.id,
          status: scheduled.status,
        },
      };
    } catch (error) {
      this.logger.error('Error cancelando notificación programada:', error);
      throw error;
    }
  }
}