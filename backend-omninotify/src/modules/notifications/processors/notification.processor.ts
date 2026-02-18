import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios'; // ✅ NUEVO - Para descargar archivos
import { firstValueFrom } from 'rxjs';

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
    private readonly httpService: HttpService, // ✅ NUEVO - Para descargar archivos
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
      // Crear log en BD
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

      // Actualizar log a éxito
      notificationLog.status = NotificationLogStatus.SENT;
      await this.notificationLogsRepository.save(notificationLog);

      // Si era una notificación programada, actualizar estado
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
      // Actualizar log a fallido
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

  // ═════════════════════════════════════════════════════════════════════════
  // WHATSAPP con soporte de ADJUNTOS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * ✅ Procesamiento de WhatsApp con Nexo
   * 
   * Funcionalidades:
   * 1. Obtiene token de Nexo desde la BD (Company_Providers_Config)
   * 2. Procesa el template y reemplaza variables
   * 3. Si hay attachments → descarga y convierte a base64
   * 4. Envía a Nexo API en formato { para, mensaje, b64 }
   */
  private async processWhatsapp(
    data: SendNotificationDto,
    job: Job,
  ): Promise<any> {
    this.logger.log(`💬 Procesando WhatsApp Nexo para: ${data.recipient}`);

    // 1️⃣ Obtener configuración de Nexo desde la BD
    const companyConfig = await this.getCompanyWhatsappConfig(data.companyId);

    if (!companyConfig || !companyConfig.token) {
      throw new Error(
        `❌ Configuración de Nexo no encontrada para empresa ${data.companyId}`,
      );
    }

    // 2️⃣ Obtener y procesar el mensaje del template
    let mensaje = '';

    if (
      data.templateId &&
      data.templateId !== 'direct-whatsapp' &&
      data.templateId !== 'simple'
    ) {
      // Usar plantilla desde BD
      try {
        const template = await this.templatesService.findOne(
          data.templateId,
          data.companyId,
        );
        mensaje = template.content;

        // Reemplazar variables en la plantilla
        if (data.variables) {
          Object.keys(data.variables).forEach((key) => {
            // Ignorar campos especiales
            if (key === 'b64' || key === 'mediaUrl' || key === 'mediaType') {
              return;
            }

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
      // Mensaje directo (sin plantilla)
      mensaje =
        data.text || data.html || data.variables?.text || 'Mensaje de WhatsApp';
    }

    // 3️⃣ Preparar payload base para Nexo API
    const nexoPayload: any = {
      para: data.recipient, // Nexo limpiará el número automáticamente
      mensaje: mensaje,
    };

    // 4️⃣ ✅ NUEVO — Procesar adjuntos (descargar y convertir a base64)
    if (data.attachments && data.attachments.length > 0) {
      const attachment = data.attachments[0]; // Nexo solo soporta 1 archivo a la vez

      this.logger.log(
        `📎 Descargando adjunto: ${attachment.url.substring(0, 50)}... (${attachment.type})`,
      );

      try {
        // Descargar el archivo y convertir a base64
        const base64Data = await this.downloadAndConvertToBase64(
          attachment.url,
        );

        // Agregar al payload en formato Nexo
        nexoPayload.b64 = {
          data: base64Data,
        };

        // Si hay caption, sobrescribir el mensaje
        if (attachment.caption) {
          nexoPayload.mensaje = attachment.caption;
        }

        this.logger.log(
          `✅ Adjunto convertido a base64 (${base64Data.length} caracteres)`,
        );
      } catch (error: any) {
        this.logger.error(`❌ Error descargando adjunto: ${error.message}`);
        throw new Error(
          `No se pudo descargar el archivo desde ${attachment.url}: ${error.message}`,
        );
      }
    }
    // Fallback: soporte para formato antiguo (variables.b64)
    else if (data.variables?.b64) {
      this.logger.log('📎 Usando b64 desde variables (formato legacy)');
      nexoPayload.b64 = data.variables.b64;
    }

    // 5️⃣ Enviar con Nexo usando el token de la BD
    const result = await this.nexoWhatsappProvider.send(
      companyConfig.token,
      nexoPayload,
    );

    this.logger.log(`✅ WhatsApp Nexo enviado exitosamente`);
    this.logger.log(`📊 Respuesta Nexo:`, JSON.stringify(result));

    return {
      provider: 'nexo',
      ...result,
      recipient: data.recipient,
      timestamp: new Date().toISOString(),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // HELPER: Descargar archivo desde URL y convertir a base64
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Descarga un archivo desde una URL pública (o data URL) y lo convierte a base64 puro
   * 
   * Soporta:
   * - URLs públicas: https://cdn.example.com/image.jpg
   * - Data URLs: data:image/jpeg;base64,/9j/4AAQ...
   * 
   * @param url URL pública o data URL
   * @returns Base64 string puro (sin prefijo "data:image/jpeg;base64,")
   */
  private async downloadAndConvertToBase64(url: string): Promise<string> {
    try {
      // Caso 1: Si es data URL (base64 embebido en el string)
      if (url.startsWith('data:')) {
        this.logger.log('📎 Data URL detectado, extrayendo base64...');
        
        // Formato: data:image/jpeg;base64,/9j/4AAQ...
        // Queremos solo: /9j/4AAQ...
        const base64Match = url.match(/^data:[^;]+;base64,(.+)$/);
        
        if (!base64Match) {
          throw new Error('Data URL inválido - no contiene base64');
        }
        
        return base64Match[1]; // Solo el base64 puro
      }

      // Caso 2: URL pública normal — descargar el archivo
      this.logger.log(`📥 Descargando archivo desde: ${url.substring(0, 50)}...`);
      
      const response = await firstValueFrom(
        this.httpService.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000, // 30 segundos
          maxRedirects: 5,
        }),
      );

      // Convertir ArrayBuffer → Buffer → Base64
      const buffer = Buffer.from(response.data);
      const base64 = buffer.toString('base64');

      this.logger.log(
        `✅ Archivo descargado y convertido (${buffer.length} bytes → ${base64.length} chars base64)`,
      );

      return base64;
    } catch (error: any) {
      this.logger.error(`❌ Error descargando ${url}: ${error.message}`);
      throw error;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SMS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Procesa envío de SMS (Vonage)
   */
  private async processSms(data: SendNotificationDto, job: Job): Promise<any> {
    this.logger.log(`📱 Procesando SMS para: ${data.recipient}`);

    // Obtener configuración de la empresa desde la BD
    const companyConfig = await this.getCompanySmsConfig(data.companyId);

    // Obtener y procesar plantilla si existe
    let text = '';
    if (data.templateId && data.templateId !== 'direct-sms') {
      const template = await this.templatesService.findOne(
        data.templateId,
        data.companyId,
      );
      text = template.content;

      // Reemplazar variables si existen
      if (data.variables) {
        Object.keys(data.variables).forEach((key) => {
          const placeholder = `{{${key}}}`;
          const value = data.variables?.[key] || '';
          text = text.replace(new RegExp(placeholder, 'g'), value);
        });
      }
    } else {
      // Mensaje directo
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

    this.logger.log(
      `✅ SMS enviado a ${data.recipient}, ID: ${result.messageId}`,
    );

    return result;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // CONFIG HELPERS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * ✅ Obtiene la configuración de WhatsApp Nexo desde la base de datos
   * 
   * Tablas involucradas:
   * - Company_Providers_Config: token específico de cada empresa
   * - Provider: info del proveedor (NEXO_WHATSAPP)
   */
  private async getCompanyWhatsappConfig(companyId: string): Promise<any> {
    try {
      this.logger.log(
        `🔍 Buscando configuración de Nexo para empresa: ${companyId}`,
      );

      // 1️⃣ Buscar el provider de Nexo WhatsApp
      const nexoProvider = await this.providerRepository.findOne({
        where: { name: 'NEXO_WHATSAPP', status: 'ACTIVE' as any },
      });

      if (!nexoProvider) {
        this.logger.error(
          '❌ Provider NEXO_WHATSAPP no encontrado en la tabla Provider',
        );

        // 🔧 FALLBACK: Usar .env solo si no está en BD (desarrollo)
        const envToken = process.env.NEXO_API_TOKEN;
        if (envToken) {
          this.logger.warn(
            '⚠️ Usando token de .env como fallback (solo para desarrollo)',
          );
          return {
            provider: 'nexo',
            token: envToken,
            source: 'env_fallback',
          };
        }

        throw new Error('Provider NEXO_WHATSAPP no configurado');
      }

      this.logger.log(
        `✅ Provider encontrado: ${nexoProvider.name} (ID: ${nexoProvider.id})`,
      );

      // 2️⃣ Buscar la configuración específica de esta empresa
      const companyConfig = await this.companyProviderConfigRepository.findOne({
        where: {
          companyId: companyId,
          providerId: Number(nexoProvider.id),
        },
      });

      if (!companyConfig) {
        throw new Error(`Empresa ${companyId} no tiene configuración de Nexo`);
      }

      this.logger.log(`✅ Configuración encontrada para empresa ${companyId}`);

      // 3️⃣ Extraer el token del campo JSON 'config'
      const token = companyConfig.config?.token;

      if (!token) {
        throw new Error('Token de Nexo no encontrado en la configuración');
      }

      this.logger.log(
        `🔑 Token de Nexo obtenido desde BD: ${token.substring(0, 10)}...`,
      );

      return {
        provider: 'nexo',
        token: token,
        providerId: nexoProvider.id,
        companyConfigId: companyConfig.id,
        source: 'database',
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error obteniendo configuración de Nexo: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Obtener configuración de SMS de la empresa
   */
  private async getCompanySmsConfig(companyId: string): Promise<any> {
    try {
      // ✅ OBTENER CONFIGURACIÓN GLOBAL DESDE BD
      const credentials = await this.systemConfigService.getVonageCredentials();

      return {
        provider: 'vonage',
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        fromNumber: credentials.fromNumber,
        source: 'system_config',
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error obteniendo configuración SMS global: ${error.message}`,
      );
      throw new Error(`No se pudo obtener configuración SMS: ${error.message}`);
    }
  }
}