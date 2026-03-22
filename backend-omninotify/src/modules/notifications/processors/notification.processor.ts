// src/modules/notifications/processors/notification.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  SendNotificationDto,
  NotificationChannel,
} from '../dto/send-notification.dto';
import { ScheduledNotification } from '../entities/scheduled-notification.entity';
import { ScheduledNotificationStatus } from '../entities/scheduled-notification.entity';
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
import { CreditsService } from '../../credits/credits.service';
import { Company } from '../../companies/entities/company.entity';
import { Contact } from '../../contacts/entities/contact.entity';
import { Channel as CreditsChannel } from '../../credits/entities/channel-cost.entity';
import { NotificationChannel as CreditsNotificationChannel } from '../../credits/entities/credit-transaction.entity';

// Tipo extendido para datos procesados
type ProcessedNotificationDto = SendNotificationDto & {
  content: string;
  processedSubject?: string;
};

@Processor('notifications', {
  // ✅ FIX stalled jobs: BullMQ marca job como stalled si el worker no responde en 30s.
  // Con transacciones MySQL + pessimistic_write podemos superar ese límite fácilmente.
  lockDuration: 120_000,   // 2 minutos antes de marcar stalled
  lockRenewTime: 50_000,   // renueva el lock cada 50s (debe ser < lockDuration/2)
})
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  // Mapas para reemplazo de variables
  private readonly WORD_TO_VARIABLE: Record<string, string> = {
    'nombre': 'nombre',
    'Nombre': 'nombre',
    'name': 'nombre',
    '👤': 'nombre',
    'email': 'email',
    'Email': 'email',
    'correo': 'email',
    '📧': 'email',
    'teléfono': 'telefono',
    'telefono': 'telefono',
    'phone': 'telefono',
    'celular': 'telefono',
    '📱': 'telefono',
    'empresa': 'empresa',
    'Empresa': 'empresa',
    'company': 'empresa',
    '🏢': 'empresa',
    'fecha': 'fecha',
    'Fecha': 'fecha',
    'date': 'fecha',
    '📅': 'fecha',
    'hora': 'hora',
    'Hora': 'hora',
    'time': 'hora',
    '⏰': 'hora',
    'sitio': 'sitioWeb',
    'web': 'sitioWeb',
    'website': 'sitioWeb',
    '🌐': 'sitioWeb',
    'mensaje': 'mensajeNotificacion',
    'Mensaje': 'mensajeNotificacion',
    'message': 'mensajeNotificacion',
    'notificación': 'mensajeNotificacion',
    'monto': 'monto',
    'Monto': 'monto',
    'amount': 'monto',
    'precio': 'monto',
    '💰': 'monto',
    'factura': 'numeroFactura',
    'Factura': 'numeroFactura',
    'invoice': 'numeroFactura',
    '🧾': 'numeroFactura',
    'límite': 'fechaLimite',
    'limite': 'fechaLimite',
    'deadline': 'fechaLimite',
    '⏳': 'fechaLimite',
  };

  private readonly VARIABLE_TO_WORDS: Record<string, string[]> = {
    'nombre': ['nombre', 'Nombre', 'NOMBRE', 'name', 'Name', '👤'],
    'email': ['email', 'Email', 'EMAIL', 'correo', 'Correo', 'mail', '📧'],
    'telefono': ['teléfono', 'telefono', 'Teléfono', 'Telefono', 'tel', 'phone', 'celular', '📱'],
    'empresa': ['empresa', 'Empresa', 'company', 'compañía', '🏢'],
    'fecha': ['fecha', 'Fecha', 'date', '📅'],
    'hora': ['hora', 'Hora', 'time', '⏰'],
    'sitioWeb': ['sitio web', 'Sitio Web', 'website', 'web', '🌐'],
    'mensajeNotificacion': ['mensaje', 'Mensaje', 'message', 'notificación'],
    'monto': ['monto', 'Monto', 'amount', 'precio', '💰'],
    'numeroFactura': ['factura', 'Factura', 'invoice', '🧾'],
    'fechaLimite': ['límite', 'limite', 'deadline', '⏳'],
  };

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

    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
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

  /**
   * 🔧 CORREGIDO: Reemplaza variables en el contenido
   * Soporta formato {{variable}} y también palabras clave
   */
  private replaceVariables(content: string, variables: Record<string, any>): string {
    if (!content) return '';
    if (!variables || Object.keys(variables).length === 0) return content;

    let result = content;

    // 🔥 PASO 1: Reemplazar {{variable}} con su valor
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value || '');
    });

    // 🔥 PASO 2: Reemplazar palabras clave (opcional, según tu lógica)
    Object.entries(variables).forEach(([key, value]) => {
      if (value && this.VARIABLE_TO_WORDS[key]) {
        this.VARIABLE_TO_WORDS[key].forEach(word => {
          const wordRegex = new RegExp(`\\b${word}\\b`, 'g');
          result = result.replace(wordRegex, value);
        });
      }
    });

    return result;
  }

  private mapToCreditsChannel(channel: NotificationChannel): CreditsChannel {
    const mapping: Record<NotificationChannel, CreditsChannel> = {
      [NotificationChannel.EMAIL]: CreditsChannel.EMAIL,
      [NotificationChannel.SMS]: CreditsChannel.SMS,
      [NotificationChannel.WHATSAPP]: CreditsChannel.WHATSAPP,
    };
    return mapping[channel];
  }

  private mapToCreditsNotificationChannel(channel: NotificationChannel): CreditsNotificationChannel {
    const mapping: Record<NotificationChannel, CreditsNotificationChannel> = {
      [NotificationChannel.EMAIL]: CreditsNotificationChannel.EMAIL,
      [NotificationChannel.SMS]: CreditsNotificationChannel.SMS,
      [NotificationChannel.WHATSAPP]: CreditsNotificationChannel.WHATSAPP,
    };
    return mapping[channel];
  }

  async process(job: Job<SendNotificationDto>): Promise<any> {
    const { data } = job;

    this.logger.log(`📨 Procesando notificación ${data.channel} para: ${data.recipient}`);

    // ✅ FIX: Log FUERA de la transacción.
    // Si la transacción hace rollback (error Nexo, créditos, etc), el log persiste
    // y el catch puede actualizarlo a FAILED. Sin esto: log:null en getStatus().
    const notificationLog = this.notificationLogsRepository.create({
      companyId: data.companyId,
      channel: data.channel,
      recipient: data.recipient,
      status: NotificationLogStatus.PENDING,
      jobId: String(job.id),
      attempts: 0,
    });
    await this.notificationLogsRepository.save(notificationLog);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const creditsChannel = this.mapToCreditsChannel(data.channel);
      const creditsNotificationChannel = this.mapToCreditsNotificationChannel(data.channel);

      const hasCredits = await this.creditsService.hasEnoughCredits(
        data.companyId,
        creditsNotificationChannel,
        1,
      );

      if (!hasCredits) {
        throw new Error(`❌ Créditos insuficientes para ${data.channel}.`);
      }

      this.logger.log(`💰 Créditos suficientes`);

      // 🔥 PASO CRÍTICO: Procesar contenido con variables (CORREGIDO)
      const processedData = await this.processTemplateContent(data);

      if (!processedData.content || processedData.content.trim() === '') {
        throw new Error('El contenido del mensaje no puede estar vacío');
      }

      const costPerMessage = await this.creditsService.getChannelCost(creditsChannel);

      const company = await queryRunner.manager.findOne(Company, {
        where: { id: data.companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!company) {
        throw new Error('Empresa no encontrada');
      }

      const balanceBefore = company.current_credits;
      const balanceAfter = balanceBefore - costPerMessage;

      await queryRunner.manager.update(
        Company,
        { id: data.companyId },
        { current_credits: balanceAfter }
      );

      this.logger.log(`💰 Créditos descontados: ${costPerMessage}`);

      let result;

      switch (data.channel) {
        case NotificationChannel.EMAIL:
          result = await this.emailProvider.sendEmail({
            ...processedData,
            subject: processedData.subject || 'Notificación de OmniNotify',
          });
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
      notificationLog.attempts = (job.attemptsMade ?? 0) + 1;
      await queryRunner.manager.save(notificationLog);

      await queryRunner.commitTransaction();

      // Auto-create or update the contact after a successful send.
      // This never blocks or fails the notification — errors are only logged.
      this.upsertContact(data.companyId, data.channel, data.recipient, data.variables)
        .catch((err: any) => this.logger.warn(`⚠️ Could not upsert contact: ${err.message}`));

      setTimeout(() => {
        (global as any).eventEmitter?.emit('credits-updated', {
          companyId: data.companyId,
          credits: balanceAfter,
        });
      }, 0);

      return {
        success: true,
        jobId: job.id,
        recipient: data.recipient,
        channel: data.channel,
        result,
        credits: {
          deducted: costPerMessage,
          balanceBefore,
          balanceAfter,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      // ✅ El log ya existe fuera de la transacción — actualizarlo directamente.
      // Antes se hacía findOne(jobId) pero el log fue borrado por el rollback.
      try {
        notificationLog.status = NotificationLogStatus.FAILED;
        notificationLog.errorMessage = this.sanitizeErrorMessage(error.message);
        notificationLog.attempts = (job.attemptsMade ?? 0) + 1;
        await this.notificationLogsRepository.save(notificationLog);
      } catch (logErr: any) {
        this.logger.error(`⚠️ No se pudo actualizar el log a FAILED: ${logErr.message}`);
      }

      this.logger.error(`❌ Error procesando job ${job.id}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 🔥 CORREGIDO Y MEJORADO: Procesa el contenido del template o usa contenido directo
   * AHORA SIEMPRE reemplaza las variables en TODOS los casos
   */
  private async processTemplateContent(
    data: SendNotificationDto
  ): Promise<ProcessedNotificationDto> {
    let processedContent = data.content || '';
    let processedSubject = data.subject;

    this.logger.log(`📋 Procesando contenido para: ${data.channel}`);

    // CASO 1: Tiene templateId
    if (data.templateId) {
      try {
        const template = await this.templatesService.findOne(
          data.templateId,
          data.companyId,
        );

        processedContent = template.content;
        this.logger.log(`📋 Usando template por ID: ${template.name || data.templateId}`);

      } catch (error) {
        this.logger.warn(`⚠️ Template ${data.templateId} no encontrado: ${error.message}`);
        if (!data.content) {
          throw new Error(`Template ${data.templateId} no encontrado y no hay contenido alternativo`);
        }
        // Si hay fallback, usar contenido directo
        processedContent = data.content;
        this.logger.log(`📋 Usando contenido directo como fallback`);
      }
    }

    // CASO 2: Tiene templateAlias
    else if (data.templateAlias) {
      try {
        const templates = await this.templatesService.findAllByCompany(data.companyId);
        // ✅ FIX: normalizar a minúsculas antes de comparar.
        // El alias se guarda en minúsculas (ej: "whatsapp_de_bienvenida")
        // pero el usuario puede mandar cualquier case ("WHATSAPP_DE_BIENVENIDA").
        const normalizedAlias = (data.templateAlias ?? '').toLowerCase().trim();
        const template = templates.find(t => (t.alias ?? '').toLowerCase() === normalizedAlias);

        if (template) {
          processedContent = template.content;
          this.logger.log(`📋 Usando template por alias: ${data.templateAlias}`);
        } else {
          this.logger.warn(`⚠️ Template alias "${data.templateAlias}" no encontrado`);
          // Mantener contenido original si existe
        }
      } catch (error) {
        this.logger.warn(`⚠️ Error buscando template por alias: ${error.message}`);
      }
    }

    // CASO 3: Contenido directo (sin template)
    else {
      this.logger.log(`📋 Usando contenido directo (sin template)`);
    }

    // 🔥 PASO CRÍTICO: SIEMPRE reemplazar variables si existen (CORREGIDO)
    if (data.variables && Object.keys(data.variables).length > 0) {
      this.logger.log(`🔄 Reemplazando variables: ${JSON.stringify(data.variables)}`);

      // Reemplazar en el contenido
      const contentBefore = processedContent.substring(0, 100);
      processedContent = this.replaceVariables(processedContent, data.variables);

      // Reemplazar en el asunto si tiene variables
      if (processedSubject && processedSubject.includes('{{')) {
        processedSubject = this.replaceVariables(processedSubject, data.variables);
      }

      this.logger.log(`✅ Contenido antes: "${contentBefore}..."`);
      this.logger.log(`✅ Contenido después: "${processedContent.substring(0, 100)}..."`);
    } else {
      this.logger.log(`📝 Sin variables para reemplazar`);
    }

    // ✅ FIX CRÍTICO: Limpiar {{placeholders}} que no recibieron valor.
    // Sin esto, Nexo recibe "{{orderNumber}}" literal → ERR_SENDING_WAPP_MSG (400).
    const unresolved = processedContent.match(/\{\{[^}]+\}\}/g);
    if (unresolved) {
      this.logger.warn(
        `⚠️ Placeholders sin valor: ${unresolved.join(', ')}. ` +
        `Se eliminan del mensaje. Enviá todas las variables que usa el template.`
      );
      processedContent = processedContent.replace(/\{\{[^}]+\}\}/g, '');
    }

    // Validar que hay contenido
    if (!processedContent || processedContent.trim() === '') {
      throw new Error('El contenido del mensaje no puede estar vacío');
    }

    // Retornar datos procesados
    return {
      ...data,
      content: processedContent,
      subject: processedSubject || data.subject,
    };
  }

  private async processWhatsapp(
    data: ProcessedNotificationDto,
    job: Job,
  ): Promise<any> {
    this.logger.log(`💬 Procesando WhatsApp Nexo para: ${data.recipient}`);

    const companyConfig = await this.getCompanyWhatsappConfig(data.companyId);

    if (!companyConfig || !companyConfig.token) {
      throw new Error(`❌ Configuración de Nexo no encontrada para empresa ${data.companyId}`);
    }

    const mensaje = data.content;
    const nexoPayload: any = {
      para: data.recipient,
      mensaje: mensaje,
    };

    if (data.attachments && data.attachments.length > 0) {
      const attachment = data.attachments[0];

      this.logger.log(`📎 Procesando adjunto: ${attachment.fileName || 'sin-nombre'} (${attachment.type})`);

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

        this.logger.log(`✅ Adjunto listo: "${fileName}" (${base64Data.length} chars base64)`);
      } catch (error: any) {
        this.logger.error(`❌ Error procesando adjunto: ${error.message}`);
        throw new Error(`No se pudo procesar el archivo adjunto: ${error.message}`);
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

  // Mapa de mime type → extensión para Data URLs
  // Nexo necesita que el campo "nombre" tenga extensión reconocible
  // para que WhatsApp muestre el ícono correcto y no lo muestre como "Sin título"
  private readonly MIME_TO_EXT: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
  };

  private readonly TYPE_TO_DEFAULT_NAME: Record<string, string> = {
    image: 'imagen.jpg',
    video: 'video.mp4',
    audio: 'audio.ogg',
    document: 'documento.pdf',
  };

  private resolveFileName(attachment: {
    url?: string;
    type: string;
    fileName?: string;
    caption?: string;
  }): string {
    // 1️⃣ Prioridad máxima: fileName explícito del request
    if (attachment.fileName && attachment.fileName.trim()) {
      return attachment.fileName.trim();
    }

    // 2️⃣ Data URL: extraer mime type y construir nombre con extensión correcta
    // Sin extensión reconocible WhatsApp muestra "Sin título" sin ícono de tipo
    if (attachment.url?.startsWith('data:')) {
      const mimeMatch = attachment.url.match(/^data:([^;]+);base64,/);
      if (mimeMatch) {
        const mime = mimeMatch[1].toLowerCase();
        const ext = this.MIME_TO_EXT[mime];
        if (ext) {
          // Nombrar según el tipo de contenido + extensión correcta
          const baseName = attachment.type === 'document' ? 'documento' :
            attachment.type === 'image' ? 'imagen' :
              attachment.type === 'video' ? 'video' :
                attachment.type === 'audio' ? 'audio' : 'archivo';
          return `${baseName}${ext}`;
        }
      }
    }

    // 3️⃣ URL pública: extraer nombre del path
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

    // 4️⃣ Fallback genérico por tipo — siempre con extensión para evitar "Sin título"
    return this.TYPE_TO_DEFAULT_NAME[attachment.type] ?? 'archivo.pdf';
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

      this.logger.log(`✅ Descargado: ${buffer.length} bytes → ${base64.length} chars base64`);

      return base64;
    } catch (error: any) {
      this.logger.error(`❌ Error descargando ${url}: ${error.message}`);
      throw error;
    }
  }

  private async processSms(
    data: ProcessedNotificationDto,
    job: Job,
  ): Promise<any> {
    this.logger.log(`📱 Procesando SMS para: ${data.recipient}`);

    const provider = data.variables?.provider || 'vonage';
    this.logger.log(`📱 Proveedor seleccionado: ${provider}`);

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

      const text = data.content;

      const smsPayload: SMSContent = {
        to: data.recipient,
        text: text,
        from: smsConfig.fromNumber,
      };

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
        throw new Error(`Empresa ${companyId} no tiene configuración de Nexo WhatsApp.`);
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

  /**
   * Convierte mensajes técnicos de error en mensajes amigables para el usuario.
   * Los mensajes técnicos (ej: "Error en Nexo API: Request failed...") se guardan
   * solo en los logs del servidor, no en el campo errorMessage del log de BD.
   */
  private sanitizeErrorMessage(raw: string): string {
    if (!raw) return 'Error desconocido al enviar la notificación';

    const msg = raw.toLowerCase();

    // Errores de Nexo / WhatsApp
    if (msg.includes('nexo') || msg.includes('err_sending_wapp') || msg.includes('whatsapp')) {
      return 'El servicio de WhatsApp no está disponible en este momento. Intente más tarde.';
    }

    // Errores de red / timeout al llamar al proveedor
    if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('econnrefused') ||
      msg.includes('network') || msg.includes('socket')) {
      return 'Error de conexión con el servicio de mensajería. Intente más tarde.';
    }

    // Error HTTP del proveedor
    if (msg.includes('request failed') || msg.includes('status code 4') || msg.includes('status code 5')) {
      return 'El proveedor de mensajería rechazó la solicitud. Verifique la configuración de la cuenta.';
    }

    // Créditos insuficientes
    if (msg.includes('créditos') || msg.includes('creditos') || msg.includes('insuficiente')) {
      return 'Créditos insuficientes para enviar la notificación. Recarga tu saldo.';
    }

    // Adjunto inválido
    if (msg.includes('adjunto') || msg.includes('base64') || msg.includes('archivo')) {
      return 'Error al procesar el archivo adjunto. Verifique que el formato sea compatible.';
    }

    // Template no encontrado
    if (msg.includes('template') || msg.includes('plantilla')) {
      return 'La plantilla seleccionada no fue encontrada. Verifique el alias o ID del template.';
    }

    // Mensaje vacío
    if (msg.includes('vacío') || msg.includes('vacio') || msg.includes('empty')) {
      return 'El contenido del mensaje está vacío. Verifique el template o el campo content.';
    }

    // Fallback: truncar el mensaje técnico a algo razonable
    return raw.substring(0, 200);
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-UPSERT CONTACT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * After a successful send, ensure the recipient exists as a Contact.
   * - WHATSAPP/SMS → saves the number in the phone field
   * - EMAIL        → saves the address in the email field
   *
   * If a contact with that phone/email already exists for this company,
   * it updates the name (if variables contain one) but leaves everything else.
   * Never throws — all errors are swallowed so the notification flow is safe.
   */
  private async upsertContact(
    companyId: string,
    channel: string,
    recipient: string,
    variables?: Record<string, any>,
  ): Promise<void> {
    // Normalize recipient: strip leading + for comparison
    const isEmail = channel === 'EMAIL';
    const whereClause = isEmail
      ? { company_id: companyId, email: recipient }
      : { company_id: companyId, phone: recipient };

    // Name from variables — try common keys in order of preference
    const name: string | undefined =
      variables?.nombre ||
      variables?.name ||
      variables?.Name ||
      undefined;

    const existing = await this.contactRepository.findOne({ where: whereClause as any });

    if (existing) {
      // Only update the name if we have one and it's not already set
      if (name && !existing.name) {
        existing.name = name;
        await this.contactRepository.save(existing);
        this.logger.log(`📇 Contact updated: ${recipient} (name: ${name})`);
      } else {
        this.logger.log(`📇 Contact already exists: ${recipient} — no changes`);
      }
      return;
    }

    // Create new contact
    const contact = this.contactRepository.create({
      company_id: companyId,
      phone: isEmail ? undefined : recipient,
      email: isEmail ? recipient : undefined,
      name: name ?? undefined,
      metadata: {},
    });

    await this.contactRepository.save(contact);
    this.logger.log(`📇 New contact created: ${recipient}${name ? ` (${name})` : ''}`);
  }

}