import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import * as sgMail from '@sendgrid/mail';

export interface EmailConfig {
  provider: 'sendgrid' | 'smtp';
  apiKey?: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    fromEmail?: string;
    fromName?: string;
  };
}

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Mail.Attachment[];
  replyTo?: string;
}

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private transporterCache = new Map<string, nodemailer.Transporter>();

  async send(config: EmailConfig, payload: EmailPayload): Promise<any> {
    this.logger.debug('📧 EmailProvider.send() llamado');
    this.logger.debug('📧 Config recibida:', JSON.stringify(config, null, 2));
    
    try {
      this.validateConfig(config);
      this.validatePayload(payload);

      let result;
      
      if (config.provider === 'sendgrid') {
        this.logger.debug('📧 Usando SendGrid');
        result = await this.sendViaSendGrid(config, payload);
      } else {
        this.logger.debug('📧 Usando SMTP');
        result = await this.sendViaSmtp(config, payload);
      }

      this.logger.log(`✅ Email enviado a: ${payload.to}`);
      return result;

    } catch (error) {
      this.logger.error(`❌ Error enviando email: ${error.message}`);
      this.logger.error('❌ Stack trace:', error.stack);
      throw new Error(`Email provider error: ${error.message}`);
    }
  }

  private async sendViaSendGrid(config: EmailConfig, payload: EmailPayload) {
    this.logger.debug('🔍 SendGrid config:', {
      apiKey: config.apiKey ? 'PRESENT' : 'MISSING',
      fromEmail: config.smtp?.fromEmail,
    });

    if (!config.apiKey) {
      throw new Error('API Key de SendGrid requerida');
    }

    sgMail.setApiKey(config.apiKey);

    const msg: any = {
      to: payload.to,
      from: {
        email: config.smtp?.fromEmail || 'noreply@omninotify.com',
        name: config.smtp?.fromName || 'OmniNotify',
      },
      subject: payload.subject,
      html: payload.html,
      text: payload.text || this.htmlToText(payload.html),
    };

    if (payload.cc) msg.cc = payload.cc;
    if (payload.bcc) msg.bcc = payload.bcc;
    if (payload.replyTo) msg.replyTo = payload.replyTo;

    this.logger.debug('📤 Enviando via SendGrid:', { to: payload.to });
    const response = await sgMail.send(msg);
    
    return {
      provider: 'sendgrid',
      messageId: response[0]?.headers?.['x-message-id'],
      statusCode: response[0]?.statusCode,
    };
  }

  private async sendViaSmtp(config: EmailConfig, payload: EmailPayload) {
    // DEBUG DETALLADO
    console.log('🔍🔍🔍 DEBUG SMTP DETALLADO 🔍🔍🔍');
    console.log('Config completo:', JSON.stringify(config, null, 2));
    console.log('SMTP object exists:', !!config.smtp);
    console.log('SMTP host:', config.smtp?.host);
    console.log('SMTP port:', config.smtp?.port);
    console.log('SMTP auth exists:', !!config.smtp?.auth);
    console.log('SMTP user:', config.smtp?.auth?.user);
    console.log('SMTP pass present:', config.smtp?.auth?.pass ? 'YES' : 'NO');
    console.log('🔍🔍🔍 FIN DEBUG 🔍🔍🔍');

    if (!config.smtp) {
      throw new Error('Configuración SMTP requerida');
    }

    if (!config.smtp.auth?.user || !config.smtp.auth?.pass) {
      throw new Error('Credenciales SMTP requeridas (user o pass vacíos)');
    }

    const cacheKey = `${config.smtp.host}:${config.smtp.port}:${config.smtp.auth.user}`;
    let transporter = this.transporterCache.get(cacheKey);

    if (!transporter) {
      this.logger.debug('🔄 Creando nuevo transporter SMTP');
      
      transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.auth.user,
          pass: config.smtp.auth.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        debug: true, // Activar debug de nodemailer
        logger: true,
      });

      // Verificar conexión
      try {
        this.logger.debug('🔍 Verificando conexión SMTP...');
        await transporter.verify();
        this.logger.debug('✅ Conexión SMTP verificada');
      } catch (verifyError) {
        this.logger.error('❌ Error verificando conexión SMTP:', verifyError.message);
        throw new Error(`No se puede conectar al servidor SMTP: ${verifyError.message}`);
      }

      this.transporterCache.set(cacheKey, transporter);
    }

    const mailOptions: Mail.Options = {
      from: `"${config.smtp.fromName || 'OmniNotify'}" <${config.smtp.fromEmail || config.smtp.auth.user}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text || this.htmlToText(payload.html),
    };

    if (payload.cc) mailOptions.cc = payload.cc;
    if (payload.bcc) mailOptions.bcc = payload.bcc;
    if (payload.replyTo) mailOptions.replyTo = payload.replyTo;

    this.logger.debug('📤 Enviando email SMTP...');
    const info = await transporter.sendMail(mailOptions);
    this.logger.debug('✅ Email SMTP enviado:', info.messageId);
    
    return {
      provider: 'smtp',
      messageId: info.messageId,
      response: info.response,
    };
  }

  private validateConfig(config: EmailConfig): void {
    this.logger.debug('🔍 Validando configuración...');
    
    if (!config.provider) {
      throw new Error('Proveedor de email no especificado');
    }

    this.logger.debug(`🔍 Proveedor: ${config.provider}`);

    if (config.provider === 'sendgrid') {
      if (!config.apiKey) {
        throw new Error('API Key de SendGrid requerida');
      }
      this.logger.debug('✅ Config SendGrid válida');
    } 
    
    else if (config.provider === 'smtp') {
      if (!config.smtp) {
        throw new Error('Configuración SMTP requerida');
      }
      
      // Validación más detallada - CORREGIDO
      const missingFields: string[] = []; // ✅ Inicializado con tipo string[]
      if (!config.smtp.host) missingFields.push('host');
      if (!config.smtp.port) missingFields.push('port');
      if (!config.smtp.auth?.user) missingFields.push('auth.user');
      if (!config.smtp.auth?.pass) missingFields.push('auth.pass');
      
      if (missingFields.length > 0) {
        throw new Error(`Faltan campos SMTP: ${missingFields.join(', ')}`);
      }
      
      this.logger.debug('✅ Config SMTP válida');
    }
  }

  private validatePayload(payload: EmailPayload): void {
    if (!payload.to) {
      throw new Error('Destinatario requerido');
    }

    if (!payload.subject?.trim()) {
      throw new Error('Asunto requerido');
    }

    if (!payload.html?.trim()) {
      throw new Error('Contenido HTML requerido');
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Método para probar conexión sin enviar email
  async testConnection(config: EmailConfig): Promise<boolean> {
    try {
      if (config.provider === 'sendgrid') {
        if (!config.apiKey) return false;
        sgMail.setApiKey(config.apiKey);
        // SendGrid no tiene verify, pero podemos probar con una petición simple
        return true;
      } 
      
      else if (config.provider === 'smtp') {
        if (!config.smtp?.auth?.user || !config.smtp?.auth?.pass) {
          return false;
        }
        
        const transporter = nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          auth: {
            user: config.smtp.auth.user,
            pass: config.smtp.auth.pass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });
        
        await transporter.verify();
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Error verificando conexión:', error.message);
      return false;
    }
  }
}