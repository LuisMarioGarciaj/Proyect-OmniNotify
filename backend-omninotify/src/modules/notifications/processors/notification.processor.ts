// src/modules/notifications/processors/notification.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { HttpService } from '@nestjs/axios';
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
} from '../../system/services/system-config.service';

// Importar módulo de créditos
import { CreditsService } from '../../credits/credits.service';
import { Company } from '../../companies/entities/company.entity';

// Tipo extendido para datos procesados (content es requerido)
type ProcessedNotificationDto = SendNotificationDto & {
  content: string; // Hacemos content requerido después del procesamiento
};

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
    
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    
    private readonly emailProvider: EmailProvider,
    private readonly smsProvider: SMSProvider,
    private readonly nexoWhatsappProvider: NexoWhatsappProvider,
    private readonly templatesService: TemplatesService,
    private readonly systemConfigService: SystemConfigService,
    private readonly httpService: HttpService,
    
    private readonly creditsService: CreditsService,
    private readonly dataSource: DataSource,
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

    const CHANNEL_COSTS = {
      [NotificationChannel.EMAIL]: 1,
      [NotificationChannel.SMS]: 2,
      [NotificationChannel.WHATSAPP]: 1,
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const requiredCredits = CHANNEL_COSTS[data.channel] || 1;
      
      const hasCredits = await this.creditsService.hasEnoughCredits(
        data.companyId,
        data.channel,
      );

      if (!hasCredits) {
        throw new Error(
          `❌ Créditos insuficientes para ${data.channel}. ` +
          `Costo: ${requiredCredits}`,
        );
      }

      this.logger.log(`💰 Créditos suficientes: ${requiredCredits} crédito(s) disponibles`);

      const notificationLog = this.notificationLogsRepository.create({
        companyId: data.companyId,
        channel: data.channel,
        recipient: data.recipient,
        status: NotificationLogStatus.PENDING,
        jobId: job.id,
      });

      await queryRunner.manager.save(notificationLog);

      // 🔥 PASO CRÍTICO: Procesar el template y obtener el contenido final
      const processedData = await this.processTemplateContent(data);

      // Verificar que el contenido no esté vacío
      if (!processedData.content || processedData.content.trim() === '') {
        throw new Error('El contenido del mensaje no puede estar vacío');
      }

      const deductionResult = await this.creditsService.deductCredits(
        data.companyId,
        data.channel,
        data.recipient,
        notificationLog.id,
        queryRunner,
      );

      this.logger.log(
        `💰 Créditos descontados: ${Math.abs(deductionResult.transaction.amount)} (Saldo anterior: ${deductionResult.transaction.balanceBefore}, Nuevo: ${deductionResult.transaction.balanceAfter})`,
      );

      let result;

      switch (data.channel) {
        case NotificationChannel.EMAIL:
          result = await this.emailProvider.sendEmail(processedData);
          break;

        case NotificationChannel.SMS:
          result = await this.processSms(processedData, job);
          break;

        case NotificationChannel.WHATSAPP:
          result = await this.processWhatsapp(processedData, job);
          break;

        default:
          throw new Error(`Canal no soportado: ${data.channel}`);
      }

      notificationLog.status = NotificationLogStatus.SENT;
      await queryRunner.manager.save(notificationLog);

      if (data.scheduledAt) {
        const scheduled = await this.scheduledNotificationRepository.findOne({
          where: { id: job.id },
        });
        if (scheduled) {
          scheduled.status = 'SENT' as any;
          await queryRunner.manager.save(scheduled);
        }
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        jobId: job.id,
        recipient: data.recipient,
        channel: data.channel,
        result,
        credits: {
          deducted: Math.abs(deductionResult.transaction.amount),
          balanceBefore: deductionResult.transaction.balanceBefore,
          balanceAfter: deductionResult.transaction.balanceAfter,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      const notificationLog = await this.notificationLogsRepository.findOne({
        where: { jobId: job.id },
      });
      
      if (notificationLog) {
        notificationLog.status = NotificationLogStatus.FAILED;
        notificationLog.errorMessage = error.message;
        await this.notificationLogsRepository.save(notificationLog);
      }

      this.logger.error(`❌ Error procesando job ${job.id}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Procesa el contenido del template y retorna un objeto con content asegurado
   */
  private async processTemplateContent(
    data: SendNotificationDto
  ): Promise<ProcessedNotificationDto> {
    // Si hay templateId, intentamos obtener el template y reemplazar variables
    if (data.templateId) {
      try {
        const template = await this.templatesService.findOne(
          data.templateId,
          data.companyId,
        );
        
        let processedContent = template.content;
        
        // Reemplazar variables si existen
        if (data.variables && Object.keys(data.variables).length > 0) {
          Object.keys(data.variables).forEach((key) => {
            const placeholder = `{{${key}}}`;
            const value = data.variables?.[key] || '';
            processedContent = processedContent.replace(
              new RegExp(placeholder, 'g'),
              value
            );
          });
        }
        
        this.logger.log(
          `📝 Template procesado: ${template.name} (${processedContent.length} chars)`
        );
        
        return {
          ...data,
          content: processedContent,
        };
      } catch (error) {
        this.logger.warn(
          `⚠️ Template ${data.templateId} no encontrado, usando contenido directo`
        );
        // Si no se encuentra el template, usamos el contenido original
        // Pero si no hay contenido original, lanzamos error
        if (!data.content || data.content.trim() === '') {
          throw new Error(`Template ${data.templateId} no encontrado y no hay contenido alternativo`);
        }
        return {
          ...data,
          content: data.content,
        };
      }
    }
    
    // Si no hay templateId, aseguramos que haya contenido
    if (!data.content || data.content.trim() === '') {
      throw new Error('No se proporcionó template ni contenido para el mensaje');
    }
    
    // Devolver los datos originales con content asegurado
    return {
      ...data,
      content: data.content,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // WHATSAPP
  // ═══════════════════════════════════════════════════════════════

  private async processWhatsapp(
    data: ProcessedNotificationDto, // Usamos el tipo procesado
    job: Job,
  ): Promise<any> {
    this.logger.log(`💬 Procesando WhatsApp Nexo para: ${data.recipient}`);

    const companyConfig = await this.getCompanyWhatsappConfig(data.companyId);

    if (!companyConfig || !companyConfig.token) {
      throw new Error(
        `❌ Configuración de Nexo no encontrada para empresa ${data.companyId}`,
      );
    }

    // El contenido ya viene procesado de processTemplateContent()
    const mensaje = data.content;

    const nexoPayload: any = {
      para: data.recipient,
      mensaje: mensaje,
    };

    if (data.attachments && data.attachments.length > 0) {
      const attachment = data.attachments[0];

      this.logger.log(
        `📎 Procesando adjunto: ${attachment.fileName || 'sin-nombre'} (${attachment.type})`,
      );

      try {
        const base64Data = await this.downloadAndConvertToBase64(attachment.url);
        const fileName = this.resolveFileName(attachment);

        nexoPayload.b64 = {
          data: base64Data,
          nombre: fileName,
        };

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
    else if (data.variables?.b64) {
      this.logger.log('📎 Usando b64 desde variables (formato legacy)');
      nexoPayload.b64 = data.variables.b64;
    }

    const result = await this.nexoWhatsappProvider.send(
      companyConfig.token,
      nexoPayload,
    );

    this.logger.log(`✅ WhatsApp Nexo enviado`);

    return {
      provider: 'nexo',
      ...result,
      recipient: data.recipient,
      timestamp: new Date().toISOString(),
    };
  }

  private resolveFileName(attachment: {
    url: string;
    type: string;
    fileName?: string;
    caption?: string;
  }): string {
    if (attachment.fileName && attachment.fileName.trim()) {
      return attachment.fileName.trim();
    }

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

    const genericNames: Record<string, string> = {
      image: 'imagen.jpg',
      video: 'video.mp4',
      audio: 'audio.ogg',
      document: 'documento.pdf',
    };

    return genericNames[attachment.type] || 'archivo';
  }

  private async downloadAndConvertToBase64(url: string): Promise<string> {
    try {
      if (url.startsWith('data:')) {
        this.logger.log('📎 Data URL detectado, extrayendo base64...');
        const base64Match = url.match(/^data:[^;]+;base64,(.+)$/);
        if (!base64Match) {
          throw new Error('Data URL inválido - no contiene base64');
        }
        return base64Match[1];
      }

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

    private async processSms(
    data: ProcessedNotificationDto,
    job: Job,
  ): Promise<any> {
    this.logger.log(`📱 Procesando SMS para: ${data.recipient}`);

    // 🔥 PASO 1: OBTENER CONFIGURACIÓN DEL PROVEEDOR DESDE LOS DATOS DEL JOB
    // Buscar en variables si viene el proveedor seleccionado
    const provider = data.variables?.provider || 'vonage'; // Por defecto vonage si no se especifica
    
    this.logger.log(`📱 Proveedor seleccionado: ${provider}`);

    // 🔥 PASO 2: OBTENER CREDENCIALES SEGÚN EL PROVEEDOR
    let smsConfig: SMSConfig = {
      provider: provider as 'vonage' | 'twilio',
    };

    try {
      if (provider === 'vonage') {
        const credentials = await this.systemConfigService.getVonageCredentials();
        smsConfig.apiKey = credentials.apiKey;
        smsConfig.apiSecret = credentials.apiSecret;
        smsConfig.fromNumber = data.variables?.fromNumber || credentials.fromNumber;
        this.logger.log('📦 Usando credenciales globales de Vonage');
      } else if (provider === 'twilio') {
        const credentials = await this.systemConfigService.getTwilioCredentials();
        smsConfig.accountSid = credentials.accountSid;
        smsConfig.authToken = credentials.authToken;
        smsConfig.fromNumber = data.variables?.fromNumber || credentials.fromNumber;
        this.logger.log('📦 Usando credenciales globales de Twilio');
      }

      // 🔥 PASO 3: PREPARAR PAYLOAD
      const text = data.content;

      const smsPayload: SMSContent = {
        to: data.recipient,
        text: text,
        from: smsConfig.fromNumber,
      };

      // 🔥 PASO 4: ENVIAR
      const result = await this.smsProvider.send(smsConfig, smsPayload);

      this.logger.log(`✅ SMS enviado a ${data.recipient} vía ${provider}`);

      return {
        ...result,
        provider,
        recipient: data.recipient,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error enviando SMS vía ${provider}: ${error.message}`);
      throw error;
    }
  }
  // ═══════════════════════════════════════════════════════════════
  // CONFIG HELPERS
  // ═══════════════════════════════════════════════════════════════

  private async getCompanyWhatsappConfig(companyId: string): Promise<any> {
    const NEXO_WHATSAPP_PROVIDER_ID = 1;

    try {
      const nexoProvider = await this.providerRepository.findOne({
        where: { id: NEXO_WHATSAPP_PROVIDER_ID as any },
      });

      if (!nexoProvider) {
        const envToken = process.env.NEXO_API_TOKEN;
        if (envToken) {
          this.logger.warn('⚠️ Usando token de .env (fallback desarrollo)');
          return { provider: 'nexo', token: envToken, source: 'env_fallback' };
        }
        throw new Error('Provider NEXO_WHATSAPP (id=1) no encontrado en la base de datos');
      }

      const companyConfig = await this.companyProviderConfigRepository.findOne({
        where: {
          companyId: companyId,
          providerId: NEXO_WHATSAPP_PROVIDER_ID,
        },
      });

      if (!companyConfig) {
        throw new Error(
          `Empresa ${companyId} no tiene configuración de Nexo WhatsApp. `,
        );
      }

      const token = companyConfig.config?.token;
      const configStatus = companyConfig.config?.status;

      if (!token) {
        if (configStatus === 'PENDING') {
          throw new Error(
            'WhatsApp no configurado para esta empresa. ' +
            'Ve a Configuración y agrega el token de Nexo.',
          );
        }
        throw new Error('Token de Nexo vacío en la configuración');
      }

      this.logger.log(`✅ Config Nexo encontrada para empresa ${companyId} (status: ${configStatus})`);

      return {
        provider: 'nexo',
        token,
        providerId: NEXO_WHATSAPP_PROVIDER_ID,
        source: 'database',
      };
    } catch (error: any) {
      this.logger.error(`❌ Error config Nexo: ${error.message}`);
      throw error;
    }
  }

  // private async getCompanySmsConfig(companyId: string): Promise<any> {
  //   try {
  //     const credentials = await this.systemConfigService.getVonageCredentials();
  //     return {
  //       provider: 'vonage',
  //       apiKey: credentials.apiKey,
  //       apiSecret: credentials.apiSecret,
  //       fromNumber: credentials.fromNumber,
  //       source: 'system_config',
  //     };
  //   } catch (error: any) {
  //     throw new Error(`No se pudo obtener configuración SMS: ${error.message}`);
  //   }
  // }
}