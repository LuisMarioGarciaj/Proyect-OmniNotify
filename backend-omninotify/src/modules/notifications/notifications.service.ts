import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog, NotificationLogStatus } from './entities/notification-log.entity';
import { SendNotificationDto } from './dto/send-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue('notification-queue') private readonly notificationQueue: Queue,
    @InjectRepository(NotificationLog) private readonly logRepo: Repository<NotificationLog>,
  ) {}

  async enqueueNotification(dto: SendNotificationDto) {
    // 1. Crea el log
    const log = new NotificationLog();
    log.company_id = dto.companyId;
    log.channel = dto.channel;
    log.recipient = dto.recipient;
    log.status = NotificationLogStatus.PENDING;
    
    // Mapea contactId → contact_id (si existe)
    if (dto.contactId) {
      log.contact_id = dto.contactId;
    }
    
    const savedLog = await this.logRepo.save(log);

    // 2. Encolar en BullMQ
    const job = await this.notificationQueue.add(
      'send-message',
      { 
        ...dto, 
        logId: savedLog.id 
      },
      { 
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 } 
      }
    );

    // 3. Actualizar el log con el jobId
    if (job.id) {
      savedLog.job_id = job.id;
      await this.logRepo.save(savedLog);
    }

    return { 
      success: true,
      jobId: job.id || null, 
      logId: savedLog.id,
      message: 'Notificación encolada exitosamente',
      status: NotificationLogStatus.PENDING
    };
  }

  async getLogs(companyId?: string, limit: number = 50) {
    const query = this.logRepo.createQueryBuilder('log');
    
    if (companyId) {
      query.where('log.company_id = :companyId', { companyId });
    }
    
    query.orderBy('log.created_at', 'DESC');
    query.limit(limit);
    
    return await query.getMany();
  }

  async getStats(companyId: string) {
    const total = await this.logRepo.count({ where: { company_id: companyId } });
    const sent = await this.logRepo.count({ where: { company_id: companyId, status: NotificationLogStatus.SENT } });
    const failed = await this.logRepo.count({ where: { company_id: companyId, status: NotificationLogStatus.FAILED } });
    const pending = await this.logRepo.count({ where: { company_id: companyId, status: NotificationLogStatus.PENDING } });
    const delivered = await this.logRepo.count({ where: { company_id: companyId, status: NotificationLogStatus.DELIVERED } });

    return {
      total,
      sent,
      failed,
      pending,
      delivered,
      successRate: total > 0 ? ((sent + delivered) / total * 100).toFixed(2) + '%' : '0%'
    };
  }

  // Método adicional para obtener un log por ID
  async findLogById(logId: string): Promise<NotificationLog | null> {
    return await this.logRepo.findOne({ where: { id: logId } });
  }

  // Método para buscar logs por jobId
  async findLogsByJobId(jobId: string): Promise<NotificationLog[]> {
    return await this.logRepo.find({ where: { job_id: jobId } });
  }
}