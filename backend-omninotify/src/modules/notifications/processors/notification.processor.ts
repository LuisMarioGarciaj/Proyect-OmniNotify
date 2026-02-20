import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as path from 'path';

import {
  SendNotificationDto,
  NotificationChannel,
} from '../dto/send-notification.dto';
import { ScheduledNotification } from '../entities/scheduled-notification.entity';
import {
  NotificationLog,
  NotificationLogStatus,
} from '../entities/notification-log.entity';
import { EmailProvider } from '../providers/email.provider';
import {
  SMSProvider,
  SMSConfig,
  SMSContent,
} from '../providers/sms/sms.provider';
import { NexoWhatsappProvider } from '../providers/nexo-whatsapp.provider';
import { TemplatesService } from '../../templates/templates.service';
import { CompanyProviderConfig } from '../../providers/entities/company-provider-config.entity';
import { Provider } from '../../providers/entities/provider.entity';
import {
  SystemConfigService,
  VonageCredentials,
} from '../../system/services/system-config.service';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @InjectRepository(ScheduledNotification)
    private scheduledNotificationRepository: Repository<ScheduledNotification>,
    
    @InjectRepository(NotificationLog)
    private notificationLogsRepository: Repository<NotificationLog>,
    
    @InjectRepository(CompanyProviderConfig)
    private companyProviderConfigRepository: Repository<CompanyProviderConfig>,
    
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
    
    private readonly emailProvider: EmailProvider,
    private readonly smsProvider: SMSProvider,
    private readonly nexoWhatsappProvider: NexoWhatsappProvider,
    private readonly templatesService: TemplatesService,
    private readonly systemConfigService: SystemConfigService,
    private readonly httpService: HttpService,
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

    this.logger.log(
      `📨 Procesando notificación ${data.channel} para: ${data.recipient}`,
    );

    try {
      const notificationLog = this.notificationLogsRepository.create({
        companyId: data.companyId,
        channel: data.channel,
        recipient: data.recipient,
        status: NotificationLogStatus.PENDING,
        jobId: job.id,
      });

      await this.notificationLogsRepository.save(notificationLog);

      let result;

      switch (data.channel) {
        case NotificationChannel.EMAIL:
          result = await this.emailProvider.sendEmail(data);
          break;

        case NotificationChannel.SMS:
          result = await this.processSms(data, job);
          break;

        case NotificationChannel.WHATSAPP:
          result = await this.processWhatsapp(data, job);
          break;

        default:
          throw new Error(`Canal no soportado: ${data.channel}`);
      }

      notificationLog.status = NotificationLogStatus.SENT;
      await this.notificationLogsRepository.save(notificationLog);

      if (data.scheduledAt) {
        const scheduled = await this.scheduledNotificationRepository.findOne({
          where: { id: job.id },
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
      const notificationLog = await this.notificationLogsRepository.findOne({
        where: { jobId: job.id },
      });
      if (notificationLog) {
        notificationLog.status = NotificationLogStatus.FAILED;
        notificationLog.errorMessage = error.message;
        await this.notificationLogsRepository.save(notificationLog);
      }

      this.logger.error(`Error procesando job ${job.id}:`, error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // WHATSAPP
  // ═══════════════════════════════════════════════════════════════

  private async processWhatsapp(
    data: SendNotificationDto,
    job: Job,
  ): Promise<any> {
    this.logger.log(`💬 Procesando WhatsApp Nexo para: ${data.recipient}`);

    // 1️⃣ Obtener token desde la BD
    const companyConfig = await this.getCompanyWhatsappConfig(data.companyId);

    if (!companyConfig || !companyConfig.token) {
      throw new Error(
        `❌ Configuración de Nexo no encontrada para empresa ${data.companyId}`,
      );
    }

    // 2️⃣ Resolver mensaje desde template
    let mensaje = '';

    if (
      data.templateId &&
      data.templateId !== 'direct-whatsapp' &&
      data.templateId !== 'simple'
    ) {
      try {
        const template = await this.templatesService.findOne(
          data.templateId,
          data.companyId,
        );
        mensaje = template.content;

        if (data.variables) {
          Object.keys(data.variables).forEach((key) => {
            if (key === 'b64' || key === 'mediaUrl' || key === 'mediaType') return;
            const placeholder = `{{${key}}}`;
            const value = data.variables?.[key] || '';
            mensaje = mensaje.replace(new RegExp(placeholder, 'g'), value);
          });
        }
      } catch (error: any) {
        this.logger.warn(
          `⚠️ Template ${data.templateId} no encontrado, usando mensaje directo`,
        );
        mensaje =
          data.text ||
          data.html ||
          data.variables?.text ||
          'Mensaje de WhatsApp';
      }
    } else {
      mensaje =
        data.text || data.html || data.variables?.text || 'Mensaje de WhatsApp';
    }

    // 3️⃣ Payload base
    const nexoPayload: any = {
      para: data.recipient,
      mensaje: mensaje,
    };

    // 4️⃣ Procesar adjunto
    if (data.attachments && data.attachments.length > 0) {
      const attachment = data.attachments[0]; // Nexo solo soporta 1 a la vez

      this.logger.log(
        `📎 Procesando adjunto: ${attachment.fileName || 'sin-nombre'} (${attachment.type})`,
      );

      try {
        const base64Data = await this.downloadAndConvertToBase64(attachment.url);

        // ✅ FIX: Incluir fileName en el payload b64
        // Nexo usa "nombre" para el nombre del archivo (campo en español como los demás)
        const fileName = this.resolveFileName(attachment);

        nexoPayload.b64 = {
          data: base64Data,
          nombre: fileName, // ← Esto evita que WhatsApp muestre "undefined"
        };

        // Si hay caption, usarlo como mensaje
        if (attachment.caption) {
          nexoPayload.mensaje = attachment.caption;
        }

        this.logger.log(
          `✅ Adjunto listo: "${fileName}" (${base64Data.length} chars base64)`,
        );
      } catch (error: any) {
        this.logger.error(`❌ Error procesando adjunto: ${error.message}`);
        throw new Error(
          `No se pudo procesar el archivo adjunto: ${error.message}`,
        );
      }
    }
    // Fallback: soporte para formato legacy (variables.b64)
    else if (data.variables?.b64) {
      this.logger.log('📎 Usando b64 desde variables (formato legacy)');
      nexoPayload.b64 = data.variables.b64;
    }

    // 5️⃣ Enviar
    const result = await this.nexoWhatsappProvider.send(
      companyConfig.token,
      nexoPayload,
    );

    this.logger.log(`✅ WhatsApp Nexo enviado`);
    this.logger.log(`📊 Respuesta Nexo:`, JSON.stringify(result));

    return {
      provider: 'nexo',
      ...result,
      recipient: data.recipient,
      timestamp: new Date().toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPER: Resolver nombre del archivo
  // ═══════════════════════════════════════════════════════════════

  /**
   * Determina el nombre del archivo a partir del attachment.
   * Prioridad:
   *   1. attachment.fileName (enviado por el frontend)
   *   2. Último segmento de la URL (si es URL pública)
   *   3. Nombre genérico según el tipo
   */
  private resolveFileName(attachment: {
    url: string;
    type: string;
    fileName?: string;
    caption?: string;
  }): string {
    // 1. Si el frontend ya mandó el nombre del archivo → usarlo directamente
    if (attachment.fileName && attachment.fileName.trim()) {
      return attachment.fileName.trim();
    }

    // 2. Si es una URL pública → extraer el nombre del último segmento
    if (attachment.url && !attachment.url.startsWith('data:')) {
      try {
        const urlPath = new URL(attachment.url).pathname;
        const segments = urlPath.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && lastSegment.includes('.')) {
          return decodeURIComponent(lastSegment);
        }
      } catch {
        // URL inválida, continuar con fallback
      }
    }

    // 3. Fallback genérico según tipo de archivo
    const genericNames: Record<string, string> = {
      image: 'imagen.jpg',
      video: 'video.mp4',
      audio: 'audio.ogg',
      document: 'documento.pdf',
    };

    return genericNames[attachment.type] || 'archivo';
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPER: Descargar y convertir a base64
  // ═══════════════════════════════════════════════════════════════

  private async downloadAndConvertToBase64(url: string): Promise<string> {
    try {
      // Data URL: extraer el base64 puro
      if (url.startsWith('data:')) {
        this.logger.log('📎 Data URL detectado, extrayendo base64...');
        const base64Match = url.match(/^data:[^;]+;base64,(.+)$/);
        if (!base64Match) {
          throw new Error('Data URL inválido - no contiene base64');
        }
        return base64Match[1];
      }

      // URL pública: descargar
      this.logger.log(`📥 Descargando: ${url.substring(0, 60)}...`);
      
      const response = await firstValueFrom(
        this.httpService.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000,
          maxRedirects: 5,
        }),
      );

      const buffer = Buffer.from(response.data);
      const base64 = buffer.toString('base64');

      this.logger.log(
        `✅ Descargado: ${buffer.length} bytes → ${base64.length} chars base64`,
      );

      return base64;
    } catch (error: any) {
      this.logger.error(`❌ Error descargando ${url}: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SMS
  // ═══════════════════════════════════════════════════════════════

  private async processSms(data: SendNotificationDto, job: Job): Promise<any> {
    this.logger.log(`📱 Procesando SMS para: ${data.recipient}`);

    const companyConfig = await this.getCompanySmsConfig(data.companyId);

    let text = '';
    if (data.templateId && data.templateId !== 'direct-sms') {
      const template = await this.templatesService.findOne(
        data.templateId,
        data.companyId,
      );
      text = template.content;

      if (data.variables) {
        Object.keys(data.variables).forEach((key) => {
          const placeholder = `{{${key}}}`;
          const value = data.variables?.[key] || '';
          text = text.replace(new RegExp(placeholder, 'g'), value);
        });
      }
    } else {
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

    this.logger.log(`✅ SMS enviado a ${data.recipient}`);

    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // CONFIG HELPERS
  // ═══════════════════════════════════════════════════════════════

  private async getCompanyWhatsappConfig(companyId: string): Promise<any> {
    try {
      const nexoProvider = await this.providerRepository.findOne({
        where: { name: 'NEXO_WHATSAPP', status: 'ACTIVE' as any },
      });

      if (!nexoProvider) {
        const envToken = process.env.NEXO_API_TOKEN;
        if (envToken) {
          this.logger.warn('⚠️ Usando token de .env (fallback desarrollo)');
          return { provider: 'nexo', token: envToken, source: 'env_fallback' };
        }
        throw new Error('Provider NEXO_WHATSAPP no configurado');
      }

      const companyConfig = await this.companyProviderConfigRepository.findOne({
        where: {
          companyId: companyId,
          providerId: Number(nexoProvider.id),
        },
      });

      if (!companyConfig) {
        throw new Error(`Empresa ${companyId} no tiene configuración de Nexo`);
      }

      const token = companyConfig.config?.token;
      if (!token) {
        throw new Error('Token de Nexo no encontrado en la configuración');
      }

      return {
        provider: 'nexo',
        token,
        providerId: nexoProvider.id,
        source: 'database',
      };
    } catch (error: any) {
      this.logger.error(`❌ Error config Nexo: ${error.message}`);
      throw error;
    }
  }

  private async getCompanySmsConfig(companyId: string): Promise<any> {
    try {
      const credentials = await this.systemConfigService.getVonageCredentials();
      return {
        provider: 'vonage',
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        fromNumber: credentials.fromNumber,
        source: 'system_config',
      };
    } catch (error: any) {
      throw new Error(`No se pudo obtener configuración SMS: ${error.message}`);
    }
  }
}