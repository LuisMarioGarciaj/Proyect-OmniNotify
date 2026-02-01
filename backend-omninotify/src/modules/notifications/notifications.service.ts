// src/modules/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationLog } from './entities/notification-log.entity'; // ✅ Singular

@Injectable()
export class NotificationsService {
  sendNotification(data: SendNotificationDto) {
    throw new Error('Method not implemented.');
  }
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectRepository(NotificationLog) // ✅ Singular
    private notificationLogsRepository: Repository<NotificationLog>, // ✅ Singular
  ) {}

  async enqueueNotification(dto: SendNotificationDto): Promise<any> {
    this.logger.log(`📨 Encolando notificación para: ${dto.recipient}`);
    
    let delay = 0;
    if (dto.scheduledAt) {
      const scheduledTime = new Date(dto.scheduledAt);
      const now = new Date();
      
      if (scheduledTime <= now) {
        throw new Error('La fecha programada debe ser futura');
      }
      
      delay = scheduledTime.getTime() - now.getTime();
      
      if (delay > 30 * 24 * 60 * 60 * 1000) {
        throw new Error('La programación no puede exceder 30 días');
      }
      
      this.logger.log(`⏰ Programado para: ${scheduledTime.toLocaleString()}`);
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
        jobId: delay > 0 ? `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : undefined,
      }
    );

    return {
      success: true,
      jobId: job.id,
      status: delay > 0 ? 'SCHEDULED' : 'QUEUED',
      scheduledAt: delay > 0 ? new Date(Date.now() + delay).toISOString() : null,
      timestamp: new Date().toISOString(),
      queue: 'notifications',
    };
  }

  async getStats(companyId: string) {
    try {
      // Obtener stats de la cola
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.notificationsQueue.getWaitingCount(),
        this.notificationsQueue.getActiveCount(),
        this.notificationsQueue.getCompletedCount(),
        this.notificationsQueue.getFailedCount(),
        this.notificationsQueue.getDelayedCount(),
      ]);

      return {
        companyId,
        queueStats: {
          waiting,
          active,
          completed,
          failed,
          delayed,
          total: waiting + active + completed + failed + delayed,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error obteniendo stats:', error);
      throw error;
    }
  }
}