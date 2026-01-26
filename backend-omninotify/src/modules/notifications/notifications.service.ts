import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from './entities/notification-log.entity';
import { SendNotificationDto } from './dto/send-notification.dto';

// Enum para los estados (si no lo tienes)
export enum NotificationLogStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  DELIVERED = 'DELIVERED'
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue('notification-queue') 
    private readonly notificationQueue: Queue,
    
    @InjectRepository(NotificationLog) 
    private readonly logRepo: Repository<NotificationLog>,
  ) {}

  async enqueueNotification(dto: SendNotificationDto) {
    // Validar si es email
    if (dto.channel === 'EMAIL') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(dto.recipient)) {
        throw new Error(`Email inválido: ${dto.recipient}`);
      }
    }

    // 1. Crear log
    const log = new NotificationLog();
    log.company_id = dto.companyId;
    log.channel = dto.channel;
    log.recipient = dto.recipient;
    log.status = NotificationLogStatus.PENDING;
    
    // ✅ SOLUCIÓN: Siempre asigna string o null
    log.contact_id = dto.contactId || null;
    
    const savedLog = await this.logRepo.save(log);

    // 2. Calcular delay si hay scheduledAt
    let delay = 0;
    if (dto.scheduledAt) {
      const scheduledTime = new Date(dto.scheduledAt).getTime();
      const now = Date.now();
      delay = Math.max(0, scheduledTime - now);
      
      if (delay > 30 * 24 * 60 * 60 * 1000) {
        throw new Error('No se puede programar más de 30 días en el futuro');
      }
    }

    // 3. Encolar en BullMQ
    const job = await this.notificationQueue.add(
      'send-message',
      { 
        ...dto, 
        logId: savedLog.id 
      },
      { 
        jobId: savedLog.id,
        delay,
        attempts: parseInt(process.env.QUEUE_ATTEMPTS || '3'),
        backoff: { 
          type: 'exponential', 
          delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '1000') 
        }
      }
    );

    // 4. Actualizar log con jobId - ✅ CORREGIDO: Usar update en lugar de save
    await this.logRepo.update(savedLog.id, {
      job_id: job.id || null // ✅ Asegurar que no sea undefined
    });

    this.logger.log(`Notificación encolada: ${dto.channel} a ${dto.recipient}`);

    return { 
      success: true,
      jobId: job.id || null, // ✅ También aquí
      logId: savedLog.id,
      message: dto.scheduledAt ? 'Notificación programada' : 'Notificación encolada',
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
    // Usar métodos de QueryBuilder para mayor compatibilidad
    const query = this.logRepo.createQueryBuilder('log')
      .where('log.company_id = :companyId', { companyId });
    
    const total = await query.getCount();
    
    const sent = await this.logRepo
      .createQueryBuilder('log')
      .where('log.company_id = :companyId AND log.status = :status', { 
        companyId, 
        status: NotificationLogStatus.SENT 
      })
      .getCount();
    
    const failed = await this.logRepo
      .createQueryBuilder('log')
      .where('log.company_id = :companyId AND log.status = :status', { 
        companyId, 
        status: NotificationLogStatus.FAILED 
      })
      .getCount();
    
    const pending = await this.logRepo
      .createQueryBuilder('log')
      .where('log.company_id = :companyId AND log.status = :status', { 
        companyId, 
        status: NotificationLogStatus.PENDING 
      })
      .getCount();
    
    const delivered = await this.logRepo
      .createQueryBuilder('log')
      .where('log.company_id = :companyId AND log.status = :status', { 
        companyId, 
        status: NotificationLogStatus.DELIVERED 
      })
      .getCount();

    return {
      total,
      sent,
      failed,
      pending,
      delivered,
      successRate: total > 0 ? ((sent + delivered) / total * 100).toFixed(2) + '%' : '0%'
    };
  }

  async findLogById(logId: string): Promise<NotificationLog | null> {
    return await this.logRepo.findOne({ where: { id: logId } });
  }

  async findLogsByJobId(jobId: string): Promise<NotificationLog[]> {
    return await this.logRepo.find({ where: { job_id: jobId } });
  }

  // Nuevo método específico para emails - CORREGIDO
  async getEmailStats(companyId: string) {
    // Usar QueryBuilder para evitar problemas de tipos
    const total = await this.logRepo
      .createQueryBuilder('log')
      .where('log.company_id = :companyId AND log.channel = :channel', { 
        companyId, 
        channel: 'EMAIL' 
      })
      .getCount();
    
    const sent = await this.logRepo
      .createQueryBuilder('log')
      .where('log.company_id = :companyId AND log.channel = :channel AND log.status = :status', { 
        companyId, 
        channel: 'EMAIL',
        status: NotificationLogStatus.SENT 
      })
      .getCount();
    
    const failed = await this.logRepo
      .createQueryBuilder('log')
      .where('log.company_id = :companyId AND log.channel = :channel AND log.status = :status', { 
        companyId, 
        channel: 'EMAIL',
        status: NotificationLogStatus.FAILED 
      })
      .getCount();

    return {
      totalEmails: total,
      sentEmails: sent,
      failedEmails: failed,
      successRate: total > 0 ? (sent / total * 100).toFixed(2) + '%' : '0%'
    };
  }
}