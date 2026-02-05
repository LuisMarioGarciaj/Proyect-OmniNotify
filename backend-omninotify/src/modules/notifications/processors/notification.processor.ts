import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';

import { SendNotificationDto, NotificationChannel } from '../dto/send-notification.dto';
import { ScheduledNotification } from '../entities/scheduled-notification.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { EmailProvider } from '../providers/email.provider';
import { SMSProvider, SMSConfig,SMSContent } from '../providers/sms/sms.provider'; // NUEVO
import { TemplatesService } from '../../templates/templates.service'; // Para renderizar plantillas
import { NotificationStatus } from '../dto/send-notification.dto';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(ScheduledNotification)
    private scheduledNotificationRepository: Repository<ScheduledNotification>,
    @InjectRepository(NotificationLog)
    private notificationLogsRepository: Repository<NotificationLog>,
    private readonly emailProvider: EmailProvider,
    private readonly smsProvider: SMSProvider, // NUEVO
    private readonly templatesService: TemplatesService, // Para procesar plantillas
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
    
    this.logger.log(`📨 Procesando notificación ${data.channel} para: ${data.recipient}`);
    
    try {
      // Crear log en BD
       const notificationLog: Partial<NotificationLog> = {
        companyId: data.companyId,
        channel: data.channel,
        recipient: data.recipient,
        status: NotificationStatus.PENDING,// Temporalmente forzar el tipo
        jobId: job.id,
      };
      //  const notificationLog = this.notificationLogsRepository.create(notificationLogData);
      await this.notificationLogsRepository.save(notificationLog);

      let result;
      
      switch (data.channel) {
        case NotificationChannel.EMAIL:
          result = await this.processEmail(data, job);
          break;
          
        case NotificationChannel.SMS:
          result = await this.processSms(data, job); // NUEVO
          break;
          
        case NotificationChannel.WHATSAPP:
          result = await this.processWhatsapp(data, job);
          break;
          
        default:
          throw new Error(`Canal no soportado: ${data.channel}`);
      }

      // Actualizar log a éxito
      notificationLog.status =NotificationStatus.SENT;
      await this.notificationLogsRepository.save(notificationLog);

      // Si era una notificación programada, actualizar estado
      if (data.scheduledAt) {
        const scheduled = await this.scheduledNotificationRepository.findOne({
          where: { id: job.id }
        });
        if (scheduled) {
          scheduled.status = 'SENT' as any;
          await this.scheduledNotificationRepository.save(scheduled);
        }
      }

      return {
        success: true,
        jobId: job.id,
        recipient: data.recipient,
        channel: data.channel,
        result,
        timestamp: new Date().toISOString(),
      };
      
    } catch (error: any) {
      // Actualizar log a fallido
      const notificationLog = await this.notificationLogsRepository.findOne({
        where: { jobId: job.id } as any
      });
      if (notificationLog) {
        notificationLog.status = NotificationStatus.FAILED;
        notificationLog.errorMessage = error.message;
        await this.notificationLogsRepository.save(notificationLog);
      }

      this.logger.error(`Error procesando job ${job.id}:`, error);
      throw error;
    }
  }

 private async processEmail(data: SendNotificationDto, job: Job): Promise<any> {
  this.logger.log(`📧 Procesando email para: ${data.recipient}`);
  
  try {
    // Crear transportador de nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, // Para puerto 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verificar conexión
    await transporter.verify();
    
    const mailOptions: any = {
      from: `"OmniNotify" <${process.env.SMTP_USER}>`,
      to: data.recipient,
      subject: data.subject || 'Notificación',
      html: data.html || '',
      text: data.text || this.htmlToText(data.html || ''),
    };

    // Enviar email
    const info = await transporter.sendMail(mailOptions);
    
    this.logger.log(`✅ Email enviado a ${data.recipient}, ID: ${info.messageId}`);
    
    return {
      provider: 'smtp',
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } catch (error: any) {
    this.logger.error(`❌ Error enviando email a ${data.recipient}:`, error.message);
    throw error;
  }
}

// Método auxiliar para convertir HTML a texto
private htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

  private async processSms(data: SendNotificationDto, job: Job): Promise<any> {
    this.logger.log(`📱 Procesando SMS para: ${data.recipient}`);
    
    // Obtener configuración de la empresa desde la BD
    // Por ahora, usamos configuración mock o de variables de entorno
    const companyConfig = await this.getCompanySmsConfig(data.companyId);
    
    // Obtener y procesar plantilla si existe
    let text = '';
    if (data.templateId && data.templateId !== 'direct-sms') {
      const template = await this.templatesService.findOne(data.templateId, data.companyId);
      text = template.content;
      
      // Reemplazar variables si existen
      if (data.variables) {
        Object.keys(data.variables).forEach(key => {
          const placeholder = `{{${key}}}`;
            const value = data.variables?.[key] || '';
          text = text.replace(new RegExp(placeholder, 'g'), value);
        });
      }
    } else {
      // Mensaje directo (para el endpoint send-direct)
      text = data.variables?.text || 'Mensaje de prueba';
    }

    const smsConfig: SMSConfig = {
      provider: companyConfig.provider || 'vonage',
      apiKey: companyConfig.apiKey,
      apiSecret: companyConfig.apiSecret,
      fromNumber: companyConfig.fromNumber,
    };

    const smsPayload: SMSContent = {
      to: data.recipient,
      text: text,
      from: companyConfig.fromNumber,
    };

    const result = await this.smsProvider.send(smsConfig, smsPayload);
    
    this.logger.log(`✅ SMS enviado a ${data.recipient}, ID: ${result.messageId}`);
    
    return result;
  }

  private async processWhatsapp(data: SendNotificationDto, job: Job): Promise<any> {
    this.logger.log(`💬 Procesando WhatsApp para: ${data.recipient}`);
    // Implementar lógica de WhatsApp (para después)
    throw new Error('WhatsApp no implementado aún');
  }

  private async getCompanySmsConfig(companyId: string): Promise<any> {
    // En una implementación real, esto vendría de la BD
    // Por ahora, usamos variables de entorno o mock data
    
    // Mock config - deberías implementar la consulta a tu tabla Company_Providers_Config
    return {
      provider: 'vonage',
      apiKey: process.env.VONAGE_API_KEY ,
      apiSecret: process.env.VONAGE_API_SECRET,
      fromNumber: process.env.VONAGE_FROM_NUMBER || 'OmniNotify',
    };
  }
}