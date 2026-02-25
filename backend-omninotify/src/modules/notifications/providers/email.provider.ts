// src/modules/notifications/providers/email.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { SendNotificationDto } from '../dto/send-notification.dto';

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      const smtpHost = this.configService.get<string>('SMTP_HOST');
      const smtpPort = this.configService.get<number>('SMTP_PORT');
      const smtpUser = this.configService.get<string>('SMTP_USER');
      const smtpPass = this.configService.get<string>('SMTP_PASS');
      const smtpSecure = this.configService.get<boolean>('SMTP_SECURE');

      this.logger.log(`📧 Configurando SMTP: ${smtpHost}:${smtpPort}`);

      if (smtpHost && smtpUser && smtpPass) {
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort || 587,
          secure: smtpSecure || false, // false para STARTTLS
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          tls: {
            // No rechazar certificados no válidos en desarrollo
            rejectUnauthorized: process.env.NODE_ENV !== 'development',
          },
        });

        // Verificar conexión
        this.transporter.verify((error, success) => {
          if (error) {
            this.logger.error(`❌ Error verificando conexión SMTP: ${error.message}`);
            // No lanzamos error aquí para no romper la app, solo logueamos
          } else {
            this.logger.log('✅ Transporter de email inicializado correctamente');
          }
        });
      } else {
        this.logger.warn('⚠️ Configuración SMTP incompleta, usando valores por defecto');
        // Usar configuración por defecto para desarrollo
        this.transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: 'hgerson3000@gmail.com',
            pass: 'hwovycjveukvzqwd',
          },
        });
      }
    } catch (error) {
      this.logger.error(`❌ Error inicializando transporter: ${error.message}`);
      throw new Error('No se pudo inicializar el servicio de email');
    }
  }

  async sendEmail(dto: SendNotificationDto): Promise<any> {
    try {
      if (!this.transporter) {
        throw new Error('Transporter no inicializado');
      }

      // 🔥 USAR EL SUBJECT DEL DTO - ¡ESTO ES CRÍTICO!
      const subject = dto.subject || 'Notificación de OmniNotify';
      
      // Log para debugging
      this.logger.log(`📧 Enviando email a ${dto.recipient}`);
      this.logger.log(`📧 Asunto: "${subject}"`);
      this.logger.log(`📧 Template ID: ${dto.templateId || 'N/A'}`);

      // Configurar remitente (usa el de configuración o genera uno enmascarado)
      const fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') || 
                       this.getMaskedEmail(dto.companyName);
      const fromName = this.configService.get<string>('SMTP_FROM_NAME') || 
                      dto.companyName || 'OmniNotify System';
      
      // Manejar el contenido de texto: usar dto.text o convertir dto.html a texto si está disponible
      const textContent = dto.text || (dto.html ? this.htmlToText(dto.html) : dto.content || '');

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: dto.recipient,
        subject: subject, // 🔥 USAMOS EL SUBJECT DEL DTO
        html: dto.html || dto.content,
        text: textContent,
        headers: {
          'X-Company-ID': dto.companyId || 'unknown',
          'X-Template-ID': dto.templateId || 'custom',
          'X-Mailer': 'OmniNotify Email Service',
        },
      };

      this.logger.log(`📧 Enviando email a ${dto.recipient} desde ${fromEmail}`);
      
      const info = await this.transporter.sendMail(mailOptions);
      
      this.logger.log(`✅ Email enviado a ${dto.recipient}: ${info.messageId}`);
      this.logger.log(`✅ Asunto usado: "${subject}"`);
      
      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
        from: { name: fromName, email: fromEmail },
        subject: subject, // Devolvemos el subject usado
      };
      
    } catch (error: any) {
      this.logger.error(`❌ Error enviando email a ${dto.recipient}:`, error.message);
      throw error;
    }
  }

  private getMaskedEmail(companyName?: string): string {
    if (!companyName) {
      return 'no-reply@omninotify.com';
    }
    
    const cleanName = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15);
    
    return cleanName.length >= 3 
      ? `no-reply@${cleanName}.com`
      : 'no-reply@omninotify.com';
  }

  private htmlToText(html: string): string {
    // Conversión simple de HTML a texto
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}