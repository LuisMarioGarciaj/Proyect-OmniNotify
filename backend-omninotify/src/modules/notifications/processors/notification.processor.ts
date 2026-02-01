import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SendNotificationDto, NotificationChannel } from '../dto/send-notification.dto';
import { ScheduledNotification, ScheduledNotificationStatus } from '../entities/scheduled-notification.entity';
import { NotificationLog, NotificationLogStatus } from '../entities/notification-log.entity';
import { EmailProvider } from '../providers/email.provider';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @InjectRepository(ScheduledNotification)
    private scheduledNotificationRepository: Repository<ScheduledNotification>,
    @InjectRepository(NotificationLog)
    private notificationLogsRepository: Repository<NotificationLog>,
    private readonly emailProvider: EmailProvider,
  ) {
    super();
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
    const jobId = job.id || '';
    
    this.logger.log(`📨 Procesando notificación para: ${data.recipient}`);
    
    try {
      // Verificar si es una notificación programada
      if (jobId.startsWith('sch_')) {
        const scheduledNotification = await this.scheduledNotificationRepository.findOne({
          where: { id: jobId }
        });
        
        if (scheduledNotification) {
          scheduledNotification.status = ScheduledNotificationStatus.PROCESSING;
          await this.scheduledNotificationRepository.save(scheduledNotification);
        }
      }

      let result;
      
      // Enviar según el canal
      switch (data.channel) {
        case NotificationChannel.EMAIL:
          result = await this.emailProvider.sendEmail(data);
          break;
          
        case NotificationChannel.SMS:
          this.logger.log(`📱 Enviando SMS a: ${data.recipient}`);
          result = { success: true, channel: 'SMS', simulated: true };
          break;
          
        case NotificationChannel.WHATSAPP:
          this.logger.log(`💬 Enviando WhatsApp a: ${data.recipient}`);
          result = { success: true, channel: 'WHATSAPP', simulated: true };
          break;
          
        default:
          throw new Error(`Canal no soportado: ${data.channel}`);
      }

      // Crear log de notificación
      const notificationLog = new NotificationLog();
      notificationLog.companyId = data.companyId;
      notificationLog.recipient = data.recipient;
      notificationLog.channel = data.channel;
      notificationLog.status = NotificationLogStatus.SENT;
      notificationLog.jobId = jobId;
      notificationLog.errorMessage = null; // Esto está bien ahora que la propiedad permite null
      notificationLog.contactId = null; // Esto está bien ahora que la propiedad permite null
      
      await this.notificationLogsRepository.save(notificationLog);

      // Actualizar estado de notificación programada si existe
      if (jobId.startsWith('sch_')) {
        const scheduledNotification = await this.scheduledNotificationRepository.findOne({
          where: { id: jobId }
        });
        
        if (scheduledNotification) {
          // IMPORTANTE: No tenemos FAILED en ScheduledNotificationStatus
          // Según tu BD, solo podemos poner SENT o CANCELLED
          scheduledNotification.status = ScheduledNotificationStatus.SENT;
          await this.scheduledNotificationRepository.save(scheduledNotification);
        }
      }

      return {
        success: true,
        jobId: jobId,
        recipient: data.recipient,
        channel: data.channel,
        timestamp: new Date().toISOString(),
        ...result,
      };
      
    } catch (error: any) {
      this.logger.error(`Error procesando job ${jobId}:`, error);
      
      // Crear log de error
      const notificationLog = new NotificationLog();
      notificationLog.companyId = data.companyId;
      notificationLog.recipient = data.recipient;
      notificationLog.channel = data.channel;
      notificationLog.status = NotificationLogStatus.FAILED;
      notificationLog.jobId = jobId;
      notificationLog.errorMessage = error.message;
      notificationLog.contactId = null;
      
      await this.notificationLogsRepository.save(notificationLog);

      // Actualizar estado de notificación programada si existe
      if (jobId.startsWith('sch_')) {
        const scheduledNotification = await this.scheduledNotificationRepository.findOne({
          where: { id: jobId }
        });
        
        if (scheduledNotification) {
          // IMPORTANTE: No tenemos FAILED en ScheduledNotificationStatus
          // Podemos dejarlo como PROCESSING o cambiarlo a otro estado
          // Según tu lógica de negocio, podrías dejarlo como PROCESSING
          // o crear un nuevo estado si es necesario
          scheduledNotification.status = ScheduledNotificationStatus.PROCESSING;
          await this.scheduledNotificationRepository.save(scheduledNotification);
          
          // OPCIONAL: Podrías agregar una columna error a la tabla si lo necesitas
          // Pero según tu esquema actual, no existe
        }
      }
      
      throw error;
    }
  }
}