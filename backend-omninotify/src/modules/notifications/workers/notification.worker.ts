import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { SendNotificationDto, NotificationChannel } from '../dto/send-notification.dto';
import { WhatsappProvider } from '../providers/whatsapp/whatsapp.provider';
import { NotificationLog, NotificationLogStatus } from '../entities/notification-log.entity';

/**
 * WORKER: Procesa todos los trabajos de notificación desde la cola BullMQ
 * 
 * Este worker es el CORAZÓN del sistema:
 * - Recibe jobs de la cola 'notifications'
 * - Rutea según el canal (EMAIL, SMS, WHATSAPP)
 * - Llama al provider correspondiente
 * - Maneja errores y reintentos automáticos
 * - Guarda logs en BD
 */
@Processor('notifications')
export class NotificationWorker extends WorkerHost {
  private readonly logger = new Logger(NotificationWorker.name);
  private startTime: number = 0;

  constructor(
    private whatsappProvider: WhatsappProvider,
    // private emailProvider: EmailProvider,        // TODO: Inyectar cuando tengas
    // private smsProvider: SmsProvider,            // TODO: Inyectar cuando tengas
    @InjectRepository(NotificationLog)
    private notificationLogRepository: Repository<NotificationLog>,
  ) {
    super();
    this.logger.log('✅ NotificationWorker inicializado correctamente');
  }

  /**
   * MÉTODO PRINCIPAL: Se ejecuta automáticamente para cada job en la cola
   * BullMQ lo llama automáticamente cuando hay trabajo en 'notifications'
   */
  async process(job: Job<SendNotificationDto>): Promise<any> {
    this.startTime = Date.now();
    const jobId = job.id?.toString() || 'unknown';

    try {
      this.logger.log(`\n${'='.repeat(70)}`);
      this.logger.log(`📬 PROCESANDO JOB: ${jobId}`);
      this.logger.log('='.repeat(70));

      // ==================== VALIDACIÓN ====================
      this.validateNotificationDto(job.data);
      const dto = job.data;

      // ==================== LOGGING ====================
      this.logJobStart(jobId, dto, job);

      // ==================== ROUTER POR CANAL ====================
      let result: any;

      switch (dto.channel) {
        case NotificationChannel.WHATSAPP:
          result = await this.handleWhatsAppNotification(dto, jobId);
          break;

        case NotificationChannel.EMAIL:
          result = await this.handleEmailNotification(dto, jobId);
          break;

        case NotificationChannel.SMS:
          result = await this.handleSmsNotification(dto, jobId);
          break;

        default:
          throw new Error(`❌ Canal no soportado: ${dto.channel}`);
      }

      // ==================== GUARDAR RESULTADO ====================
      await this.saveNotificationLog(
        dto,
        result,
        NotificationLogStatus.SENT,
        jobId
      );

      const duration = Date.now() - this.startTime;
      this.logger.log(`✅ JOB COMPLETADO EXITOSAMENTE en ${duration}ms`);
      this.logger.log(`📤 Resultado: ${result?.messageSid || result?.status || 'OK'}`);
      this.logger.log('='.repeat(70) + '\n');

      return result;
    } catch (error: any) {
      const duration = Date.now() - this.startTime;

      this.logger.error(`\n❌ JOB FALLIDO: ${jobId}`);
      this.logger.error(`⏱️  Duración: ${duration}ms`);
      this.logger.error(`📝 Error: ${error.message}`);
      this.logger.error(`🔄 Intento: ${job.attemptsMade}/${job.opts.attempts || 3}`);
      this.logger.error('='.repeat(70) + '\n');

      // Guardar error en BD
      await this.saveNotificationLog(
        job.data,
        { error: error.message },
        NotificationLogStatus.FAILED,
        jobId,
        error.message
      );

      // Re-lanzar para que BullMQ reintente automáticamente
      throw error;
    }
  }

  // ==================== HANDLERS POR CANAL ====================

  /**
   * HANDLER: Procesa notificaciones por WhatsApp
   */
  private async handleWhatsAppNotification(
    dto: SendNotificationDto,
    jobId: string
  ): Promise<any> {
    try {
      this.logger.log(`📱 CANAL: WhatsApp`);
      this.logger.log(`📞 Destinatario: ${dto.recipient}`);
      this.logger.log(`🏢 Empresa: ${dto.companyId}`);

      // Validar disponibilidad del proveedor
      if (!this.whatsappProvider.isAvailable()) {
        throw new Error('⚠️  Servicio de WhatsApp no configurado. Verifica TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN');
      }

      let result: any;

      // Determinar tipo de mensaje a enviar
      if (dto.variables?.mediaUrl) {
        // Mensaje con media (imagen, PDF, etc)
        this.logger.log(`📸 Tipo: Mensaje con media`);
        this.logger.log(`🔗 URL: ${dto.variables.mediaUrl}`);
        
        result = await this.whatsappProvider.sendMediaMessage(
          dto.recipient,
          dto.text || dto.html || 'Mensaje de WhatsApp',
          dto.variables.mediaUrl,
          dto.variables.mediaType
        );
      } else if (dto.templateId && dto.templateId !== 'simple' && dto.templateId !== 'scheduled') {
        // Mensaje con template
        this.logger.log(`📋 Tipo: Template`);
        this.logger.log(`🏷️  Template: ${dto.templateId}`);
        
        result = await this.whatsappProvider.sendTemplate(
          dto.recipient,
          dto.templateId,
          dto.variables
        );
      } else {
        // Mensaje de texto simple
        this.logger.log(`💬 Tipo: Mensaje de texto simple`);
        this.logger.log(`📄 Contenido: ${(dto.text || dto.html || 'N/A').substring(0, 50)}...`);
        
        result = await this.whatsappProvider.sendMessage(
          dto.recipient,
          dto.text || dto.html || 'Mensaje de WhatsApp',
          { 
            webhookUrl: process.env.TWILIO_WEBHOOK_URL,
            jobId: jobId,
          }
        );
      }

      this.logger.log(`✅ Mensaje enviado exitosamente`);
      this.logger.log(`📮 Message SID: ${result.messageSid}`);

      return {
        channel: NotificationChannel.WHATSAPP,
        messageSid: result.messageSid,
        status: result.status,
        recipient: result.to,
        timestamp: result.timestamp,
        jobId: jobId,
        provider: 'twilio',
      };
    } catch (error: any) {
      this.logger.error(`❌ WhatsApp Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * HANDLER: Procesa notificaciones por Email
   * TODO: Integrar con tu EmailProvider existente
   */
  private async handleEmailNotification(
    dto: SendNotificationDto,
    jobId: string
  ): Promise<any> {
    try {
      this.logger.log(`📧 CANAL: Email`);
      this.logger.log(`📧 Destinatario: ${dto.recipient}`);
      this.logger.log(`📋 Template: ${dto.templateId}`);

      // TODO: Descomentar cuando tengas EmailProvider inyectado
      // const result = await this.emailProvider.sendEmail({
      //   to: dto.recipient,
      //   subject: dto.subject,
      //   html: dto.html,
      //   text: dto.text,
      //   companyId: dto.companyId,
      //   variables: dto.variables,
      // });

      // Por ahora, simular respuesta (IMPORTANTE: cambiar cuando integres Email)
      this.logger.warn(`⚠️  EMAIL: Handler aún no integrado. Simular respuesta...`);
      
      return {
        channel: NotificationChannel.EMAIL,
        status: 'sent',
        recipient: dto.recipient,
        timestamp: new Date().toISOString(),
        jobId: jobId,
        provider: 'nodemailer/sendgrid',
        message: 'Email simulado - configura el handler',
      };
    } catch (error: any) {
      this.logger.error(`❌ Email Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * HANDLER: Procesa notificaciones por SMS
   * TODO: Integrar con tu SmsProvider (también Twilio)
   */
  private async handleSmsNotification(
    dto: SendNotificationDto,
    jobId: string
  ): Promise<any> {
    try {
      this.logger.log(`📱 CANAL: SMS`);
      this.logger.log(`📞 Destinatario: ${dto.recipient}`);
      this.logger.log(`📋 Template: ${dto.templateId}`);

      // TODO: Descomentar cuando tengas SmsProvider inyectado
      // const result = await this.smsProvider.sendSms({
      //   to: dto.recipient,
      //   body: dto.text || dto.html,
      // });

      // Por ahora, simular respuesta
      this.logger.warn(`⚠️  SMS: Handler aún no integrado. Simular respuesta...`);
      
      return {
        channel: NotificationChannel.SMS,
        status: 'sent',
        recipient: dto.recipient,
        timestamp: new Date().toISOString(),
        jobId: jobId,
        provider: 'twilio',
        message: 'SMS simulado - configura el handler',
      };
    } catch (error: any) {
      this.logger.error(`❌ SMS Error: ${error.message}`);
      throw error;
    }
  }

  // ==================== MÉTODOS AUXILIARES ====================

  /**
   * Valida que el DTO tenga todos los campos requeridos
   */
  private validateNotificationDto(dto: SendNotificationDto): void {
    if (!dto) {
      throw new Error('DTO es nulo o indefinido');
    }

    const required = ['companyId', 'channel', 'recipient'];
    const missing = required.filter(
      field => !dto[field as keyof SendNotificationDto]
    );

    if (missing.length > 0) {
      throw new Error(`❌ Campos requeridos faltantes: ${missing.join(', ')}`);
    }

    if (!Object.values(NotificationChannel).includes(dto.channel)) {
      throw new Error(`❌ Canal no válido: ${dto.channel}. Valores permitidos: ${Object.values(NotificationChannel).join(', ')}`);
    }

    if (!dto.recipient || dto.recipient.trim().length === 0) {
      throw new Error('❌ Destinatario (recipient) no puede estar vacío');
    }
  }

  /**
   * Guarda un log de la notificación en BD
   */
  private async saveNotificationLog(
    dto: SendNotificationDto,
    result: any,
    status: NotificationLogStatus,
    jobId: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      // 🔥 CORREGIDO: Usar NotificationLogStatus en lugar de NotificationStatus
      const logData = {
        id: uuidv4(),
        companyId: dto.companyId,
        channel: dto.channel,
        recipient: dto.recipient,
        status: status,
        jobId: jobId,
        errorMessage: errorMessage || null,
        contactId: dto.contactId || null,
      };

      const log = this.notificationLogRepository.create(logData);
      await this.notificationLogRepository.save(log);

      this.logger.log(`💾 Log guardado en BD para job ${jobId}`);
    } catch (error: any) {
      this.logger.warn(`⚠️  No se pudo guardar log en BD: ${error.message}`);
      // No re-lanzar el error porque no queremos que falle el job por esto
    }
  }

  /**
   * Logging detallado de inicio del job
   */
  private logJobStart(jobId: string, dto: SendNotificationDto, job: Job): void {
    this.logger.log(`\n📋 INFORMACIÓN DEL JOB:`);
    this.logger.log(`  🆔 ID: ${jobId}`);
    this.logger.log(`  🏢 Empresa: ${dto.companyId}`);
    this.logger.log(`  📬 Canal: ${dto.channel}`);
    this.logger.log(`  👥 Destinatario: ${dto.recipient}`);
    this.logger.log(`  📋 Template: ${dto.templateId || 'N/A'}`);
    this.logger.log(`  🔄 Intento: ${job.attemptsMade + 1}/${job.opts.attempts || 3}`);
    
    // 🔥 CORREGIDO: Usar scheduling en lugar de scheduledAt
    if (dto.scheduling?.is_scheduled && dto.scheduling.send_at) {
      this.logger.log(`  📅 Programado para: ${dto.scheduling.send_at}`);
    }

    if (dto.variables && Object.keys(dto.variables).length > 0) {
      this.logger.log(`  🔧 Variables: ${Object.keys(dto.variables).length} definidas`);
    }

    this.logger.log(`\n🚀 Iniciando procesamiento...\n`);
  }

  // ==================== EVENT HANDLERS ====================
  // WorkerHost proporciona estos métodos que se llaman automáticamente

  /**
   * Se ejecuta cuando un job inicia el procesamiento
   */
  onActive(job: Job): void {
    this.logger.debug(`🟢 Job #${job.id} iniciado - Procesando...`);
  }

  /**
   * Se ejecuta cuando un job falla
   */
  onFailed(job: Job | undefined, err: Error): void {
    if (job) {
      const attemptInfo = `${job.attemptsMade}/${job.opts.attempts || 3}`;
      this.logger.error(`🔴 Job #${job.id} falló (intento ${attemptInfo}): ${err.message}`);
    }
  }

  /**
   * Se ejecuta cuando un job se completa exitosamente
   */
  onCompleted(job: Job | undefined, result: any): void {
    if (job) {
      this.logger.log(`🟢 Job #${job.id} completado: ${result?.messageSid || 'OK'}`);
    }
  }

  /**
   * Se ejecuta cuando el worker está listo para procesar
   */
  onReady(): void {
    this.logger.log('✨ 🚀 Worker LISTO para procesar notificaciones');
  }

  /**
   * Se ejecuta en caso de error general del worker
   */
  onError(err: Error): void {
    this.logger.error(`🔴 ERROR EN WORKER: ${err.message}`);
  }

  /**
   * Se ejecuta cuando el worker cierra
   */
  onClose(): void {
    this.logger.log('⛔ Worker cerrado');
  }
}