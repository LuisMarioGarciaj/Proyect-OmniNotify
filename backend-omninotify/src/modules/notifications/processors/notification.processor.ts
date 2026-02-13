import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
    @InjectRepository(CompanyProviderConfig) // ✅ NUEVO - Para consultar config de empresa
    private companyProviderConfigRepository: Repository<CompanyProviderConfig>,
    @InjectRepository(Provider) // ✅ NUEVO - Para consultar providers
    private providerRepository: Repository<Provider>,
    private readonly emailProvider: EmailProvider,
    private readonly smsProvider: SMSProvider,
    private readonly nexoWhatsappProvider: NexoWhatsappProvider,
    private readonly templatesService: TemplatesService,
    private readonly systemConfigService: SystemConfigService,
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

  /**
   * ✅ IMPLEMENTACIÓN CORRECTA - CONSULTA BD
   * Obtiene el token de Nexo desde la tabla Company_Providers_Config
   */
  private async processWhatsapp(
    data: SendNotificationDto,
    job: Job,
  ): Promise<any> {
    this.logger.log(`💬 Procesando WhatsApp Nexo para: ${data.recipient}`);

    // 1️⃣ Obtener configuración de Nexo desde la BD (NO desde .env)
    const companyConfig = await this.getCompanyWhatsappConfig(data.companyId);

    if (!companyConfig || !companyConfig.token) {
      throw new Error(
        `❌ Configuración de Nexo no encontrada para empresa ${data.companyId}`,
      );
    }

    // 2️⃣ Obtener y procesar el mensaje
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
            // Ignorar campos especiales (b64, mediaUrl, etc)
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

    // 3️⃣ Preparar payload para Nexo API
    const nexoPayload: any = {
      para: data.recipient, // Nexo limpiará el número automáticamente
      mensaje: mensaje,
    };

    // 4️⃣ Agregar media (base64) si existe
    if (data.variables?.b64) {
      this.logger.log('📎 Mensaje con media (base64)');
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

  /**
   * Procesa envío de SMS (Vonage/Twilio)
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

  /**
   * ✅ IMPLEMENTACIÓN CORRECTA - CONSULTA BD
   *
   * Obtiene la configuración de WhatsApp Nexo desde la base de datos.
   *
   * Tablas involucradas:
   * - Company_Providers_Config: Contiene el token específico de cada empresa
   * - Provider: Contiene info del proveedor (NEXO_WHATSAPP)
   *
   * Ejemplo de datos en BD:
   * Company_Providers_Config:
   *   - id: "30ba6347-ffae-11f0-86e6-a2aaf909b30d"
   *   - company_id: "25a63d10-eff4-11f0-86e6-a2aaf909b30d"
   *   - provider_id: 1
   *   - config: {"token": "15c461b4-76ac-4c71-ac98-975901a98efb"}
   *
   * Provider:
   *   - id: 1
   *   - name: "NEXO_WHATSAPP"
   *   - status: "ACTIVE"
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
   * TODO: Implementar consulta a BD similar a getCompanyWhatsappConfig
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
        source: 'system_config', // Indicar que viene de configuración global
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error obteniendo configuración SMS global: ${error.message}`,
      );
      throw new Error(`No se pudo obtener configuración SMS: ${error.message}`);
    }
  }
  
}
