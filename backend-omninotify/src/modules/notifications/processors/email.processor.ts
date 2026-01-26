import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EmailProvider, EmailConfig } from '../providers/email.provider';
import { NotificationLog } from '../entities/notification-log.entity';
import { NotificationLogStatus } from '../notifications.service';

@Processor('notification-queue')
@Injectable()
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
    private readonly emailProvider: EmailProvider,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { data } = job;
    const { channel, recipient, logId, companyId } = data;

    // Solo procesar emails
    if (channel !== 'EMAIL') {
      return { skipped: true, reason: 'Not an email channel' };
    }

    // ✅ CORREGIDO: Asegurar que job.id no sea undefined
    const jobId = job.id ? job.id : 'unknown-job-id';
    
    this.logger.log(`Procesando email job ${jobId} para ${recipient}`);

    try {
      // Buscar el log
      const log = await this.logRepo.findOne({ where: { id: logId } });
      if (!log) {
        throw new Error(`Log ${logId} no encontrado`);
      }

      // Obtener configuración de email de la empresa
      const emailConfig = await this.getCompanyEmailConfig(companyId);

      // Crear contenido del email
      const emailContent = this.createEmailContent(data);

      // Enviar el email
      const result = await this.emailProvider.send(emailConfig, {
        to: recipient,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      // Actualizar log como enviado
      log.status = NotificationLogStatus.SENT;
      log.error_message = null;
      await this.logRepo.save(log);

      this.logger.log(`✅ Email enviado: ${recipient}`);
      
      return {
        success: true,
        jobId: jobId, // ✅ Usar la variable corregida
        messageId: result.messageId,
        provider: result.provider,
      };

    } catch (error) {
      this.logger.error(`❌ Error procesando email: ${error.message}`);

      // Actualizar log como fallido
      const log = await this.logRepo.findOne({ where: { id: logId } });
      if (log) {
        log.status = NotificationLogStatus.FAILED;
        // ✅ CORREGIDO: Asegurar que error.message no sea undefined
        const errorMessage = error.message ? error.message.substring(0, 500) : 'Error desconocido';
        log.error_message = errorMessage;
        await this.logRepo.save(log);
      }

      // Relanzar error para reintentos
      throw error;
    }
  }

  // Método de ejemplo para obtener configuración
  private async getCompanyEmailConfig(companyId: string): Promise<EmailConfig> {
    // EN PRODUCCIÓN: Obtener de la base de datos
    // Por ahora usamos variables de entorno
    
    const useSendGrid = process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key_here';
    
    if (useSendGrid) {
      // ✅ CORREGIDO: Asegurar que process.env.SENDGRID_API_KEY no sea undefined
      const apiKey = process.env.SENDGRID_API_KEY || '';
      const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@omninotify.com';
      const fromName = process.env.SMTP_FROM_NAME || 'OmniNotify';
      
      return {
        provider: 'sendgrid',
        apiKey: apiKey,
        smtp: {
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: {
            user: 'apikey',
            pass: apiKey,
          },
          fromEmail: fromEmail,
          fromName: fromName,
        },
      };
    }

    // Fallback a SMTP
    const smtpHost = process.env.SMTP_HOST || 'localhost';
    const smtpPort = parseInt(process.env.SMTP_PORT || '1025');
    const smtpUser = process.env.SMTP_USER || 'test';
    const smtpPass = process.env.SMTP_PASS || 'test';
    const smtpFromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@omninotify.com';
    const smtpFromName = process.env.SMTP_FROM_NAME || 'OmniNotify';
    
    return {
      provider: 'smtp',
      smtp: {
        host: smtpHost,
        port: smtpPort,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        fromEmail: smtpFromEmail,
        fromName: smtpFromName,
      },
    };
  }

  private createEmailContent(data: any): { subject: string; html: string; text: string } {
    // Ejemplo simple - en producción usarías plantillas
    const variables = data.variables || {};
    
    let html = '<h1>Notificación de OmniNotify</h1>';
    if (variables.nombre) {
      html = `<h1>Hola ${variables.nombre}!</h1>`;
    }
    
    html += '<p>Este es un mensaje automático.</p>';
    
    // Reemplazar variables
    Object.keys(variables).forEach(key => {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), variables[key]);
    });

    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    return {
      subject: variables.asunto || 'Notificación OmniNotify',
      html,
      text,
    };
  }
}