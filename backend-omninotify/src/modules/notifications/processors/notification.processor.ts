import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';

import { SendNotificationDto } from '../dto/send-notification.dto';
import { NotificationChannel } from '../dto/send-notification.dto';
import { ScheduledNotification } from '../entities/scheduled-notification.entity';
import { NotificationLog } from '../entities/notification-log.entity';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(ScheduledNotification)
    private scheduledNotificationRepository: Repository<ScheduledNotification>,
    @InjectRepository(NotificationLog)
    private notificationLogsRepository: Repository<NotificationLog>,
  ) {
    super();
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`▶️ Procesando job ${job.id}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    this.logger.log(`✅ Job ${job.id} completado`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Job ${job.id} falló: ${error.message}`);
  }

  async process(job: Job<SendNotificationDto>): Promise<any> {
    const { data } = job;
    
    this.logger.log(`📨 Procesando notificación para: ${data.recipient}`);
    
    try {
      // Implementa la lógica de envío aquí
      // Por ahora solo un log
      this.logger.log(`📧 Simulando envío a: ${data.recipient}`);
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulación
      
      return {
        success: true,
        jobId: job.id,
        recipient: data.recipient,
        timestamp: new Date().toISOString(),
      };
      
    } catch (error: any) {
      this.logger.error(`Error procesando job ${job.id}:`, error);
      throw error;
    }
  }
}