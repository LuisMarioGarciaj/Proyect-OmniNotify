import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SendUnifiedNotificationDto, MAX_RESEND_ATTEMPTS, MAX_RETRY_INTERVAL_MINUTES, MIN_RETRY_INTERVAL_MINUTES } from './dto/send-unified.dto';
import { Template } from '../templates/entities/template.entity';
import { ScheduledNotification } from './entities/scheduled-notification.entity';
import { NotificationLog, NotificationLogStatus } from './entities/notification-log.entity';
import { ScheduledNotificationStatus } from './entities/scheduled-notification.entity';
import { SendNotificationResponseDto } from './dto/send-notification.dto';

@Injectable()
export class NotificationUnifiedService {
  private readonly logger = new Logger(NotificationUnifiedService.name);

  constructor(
    @InjectRepository(Template)
    private templateRepo: Repository<Template>,

    @InjectRepository(ScheduledNotification)
    private scheduledRepo: Repository<ScheduledNotification>,

    @InjectRepository(NotificationLog)
    private logRepo: Repository<NotificationLog>,

    @InjectQueue('notifications')
    private notificationQueue: Queue,
  ) { }

  /**
   * 🎯 MÉTODO PRINCIPAL UNIFICADO
   */
  async send(companyId: string, dto: SendUnifiedNotificationDto): Promise<SendNotificationResponseDto> {
    this.logger.log(`📨 Enviando notificación: ${dto.channel} → ${dto.recipient}`);

    // 1️⃣ Validar que tenga template O contenido directo
    if (!dto.templateAlias && !dto.templateId && !dto.content) {
      throw new BadRequestException('Debes proporcionar templateAlias, templateId o content');
    }

    // 2️⃣ Resolver template (si existe)
    const template = await this.resolveTemplate(companyId, dto);

    // 3️⃣ Validar destinatario según canal
    this.validateRecipient(dto.channel, dto.recipient);

    // 4️⃣ Validar adjuntos (solo WhatsApp puede tener adjuntos)
    if (dto.attachments && dto.attachments.length > 0) {
      if (dto.channel !== 'WHATSAPP') {
        throw new BadRequestException(
          'Los adjuntos solo están disponibles para el canal WHATSAPP'
        );
      }

      if (dto.attachments.length > 1) {
        this.logger.warn(
          `⚠️ Se enviaron ${dto.attachments.length} adjuntos, pero Nexo solo soporta 1. Se usará el primero.`
        );
      }
    }

    // 5️⃣ Resolver config de reintentos
    const { attempts, delayMs } = this.resolveResendConfig(dto);

    // 6️⃣ Decidir: ¿Es programado o inmediato?
    const isScheduled = dto.scheduling?.is_scheduled === true && dto.scheduling?.send_at;

    if (isScheduled) {
      return this.scheduleNotification(companyId, template, dto, attempts, delayMs);
    } else {
      return this.sendImmediate(companyId, template, dto, attempts, delayMs);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * 🔍 Resolver template por alias O por ID (si existe)
   * 🔥 AHORA PERMITE QUE SEA NULL SI HAY CONTENIDO DIRECTO
   */
  private async resolveTemplate(
    companyId: string,
    dto: SendUnifiedNotificationDto
  ): Promise<Template | null> {
    // Si tiene contenido directo y no tiene template, retorna null
    if (dto.content && !dto.templateAlias && !dto.templateId) {
      return null;
    }

    let template: Template | null = null;

    // Opción 1: Buscar por alias (recomendado)
    if (dto.templateAlias) {
      // ✅ FIX: normalizar alias a minúsculas antes de buscar en BD
      const normalizedAlias = dto.templateAlias.toLowerCase().trim();
      template = await this.templateRepo.findOne({
        where: {
          company_id: companyId,
          alias: normalizedAlias,
          channel: dto.channel,
        },
      });

      if (!template) {
        // Listar aliases disponibles para dar mensaje útil
        const available = await this.templateRepo.find({
          where: { company_id: companyId, channel: dto.channel },
          select: ['alias', 'name'] as any,
        });
        const availableList = available.map((t: any) => `"${(t.alias ?? '').toUpperCase()}"`).join(', ');
        throw new NotFoundException(
          `Plantilla "${dto.templateAlias}" no encontrada para canal ${dto.channel}. ` +
          `Disponibles: ${availableList || 'ninguna'}. Usa GET /notifications/templates para ver todas.`
        );
      }
    }
    // Opción 2: Buscar por ID (compatible con código antiguo)
    else if (dto.templateId) {
      template = await this.templateRepo.findOne({
        where: {
          id: dto.templateId,
          company_id: companyId,
        },
      });

      if (!template) {
        throw new NotFoundException(
          `Plantilla con ID "${dto.templateId}" no encontrada`
        );
      }
    }

    return template;
  }

  /**
   * ✅ Validar destinatario según canal
   */
  private validateRecipient(channel: string, recipient: string): void {
    switch (channel) {
      case 'EMAIL': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipient)) {
          throw new BadRequestException('Email inválido');
        }
        break;
      }

      case 'SMS':
      case 'WHATSAPP': {
        const phoneRegex = /^\+?[1-9]\d{7,14}$/;
        if (!phoneRegex.test(recipient)) {
          throw new BadRequestException(
            'Número inválido. Formato esperado: +59176131645'
          );
        }
        break;
      }
    }
  }

  /**
   * ⏰ Guardar en SCHEDULED_NOTIFICATION (programado)
   */
  private async scheduleNotification(
    companyId: string,
    template: Template | null,
    dto: SendUnifiedNotificationDto,
    attempts: number,
    delayMs: number,
  ): Promise<SendNotificationResponseDto> {
    const scheduledAt = new Date(dto.scheduling!.send_at!);
    const now = new Date();

    if (scheduledAt <= now) {
      throw new BadRequestException('La fecha de programación debe ser futura');
    }

    // 🔥 Preparar datos para guardar - SIN templateId si template es null
    const scheduledData: Partial<ScheduledNotification> = {
      companyId: companyId,
      channel: dto.channel,
      recipient: dto.recipient,
      variables: dto.variables || {},
      scheduledAt: scheduledAt,
      status: ScheduledNotificationStatus.SCHEDULED,
    };

    // Solo agregar templateId si existe template
    if (template) {
      scheduledData.templateId = template.id;
    }

    const scheduled = this.scheduledRepo.create(scheduledData);
    const savedScheduled = await this.scheduledRepo.save(scheduled);

    const delay = scheduledAt.getTime() - now.getTime();

    // 🔥 Preparar datos para el job
    const jobData: any = {
      scheduledNotificationId: savedScheduled.id,
      companyId,
      channel: dto.channel,
      recipient: dto.recipient,
      variables: dto.variables || {},
      attachments: dto.attachments || [],
      metadata: dto.metadata || {},
    };

    // Solo agregar templateId si existe template
    if (template) {
      jobData.templateId = template.id;
    }

    // Agregar contenido directo si no hay template
    if (!template && dto.content) {
      jobData.content = dto.content;
      if (dto.subject) jobData.subject = dto.subject;
    }

    const job = await this.notificationQueue.add(
      'send-notification',
      jobData,
      {
        delay,
        attempts,
        backoff: { type: 'custom', delay: delayMs },
      },
    );

    this.logger.log(`⏰ Programado para: ${scheduledAt.toISOString()}`);

    return {
      success: true,
      message: 'Notificación programada exitosamente',
      data: {
        id: savedScheduled.id,
        jobId: job.id as string,
        recipient: dto.recipient,
        channel: dto.channel,
        companyId: companyId,
        status: 'scheduled',
        scheduledAt: scheduledAt.toISOString(),
        attemptsConfigured: attempts,
        retryIntervalMinutes: delayMs / 60_000,
        hasAttachments: (dto.attachments?.length ?? 0) > 0,
        checkStatusUrl: `/notifications/status?jobId=${job.id}`,
      },
    };
  }

  /**
   * 🚀 Envío inmediato (encolar sin guardar en BD aún)
   */
  private async sendImmediate(
    companyId: string,
    template: Template | null,
    dto: SendUnifiedNotificationDto,
    attempts: number,
    delayMs: number,
  ): Promise<SendNotificationResponseDto> {
    // 🔥 Preparar datos para el job
    const jobData: any = {
      companyId: companyId,
      channel: dto.channel,
      recipient: dto.recipient,
      variables: dto.variables || {},
      attachments: dto.attachments || [],
      metadata: dto.metadata || {},
    };

    // Solo agregar templateId si existe template
    if (template) {
      jobData.templateId = template.id;
    }

    // Agregar contenido directo si no hay template
    if (!template && dto.content) {
      jobData.content = dto.content;
      if (dto.subject) jobData.subject = dto.subject;
    }

    const job = await this.notificationQueue.add(
      'send-notification',
      jobData,
      {
        attempts,
        backoff: { type: 'custom', delay: delayMs },
      },
    );

    this.logger.log(`🚀 Encolado para envío inmediato: Job ${job.id}`);

    return {
      success: true,
      message: 'Notificación encolada para envío inmediato',
      data: {
        jobId: job.id as string,
        recipient: dto.recipient,
        channel: dto.channel,
        companyId: companyId,
        status: 'queued',
        attemptsConfigured: attempts,
        retryIntervalMinutes: delayMs / 60_000,
        hasAttachments: (dto.attachments?.length ?? 0) > 0,
        checkStatusUrl: `/notifications/status?jobId=${job.id}`,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADO DE UN ENVÍO
  // ═══════════════════════════════════════════════════════════════════════════

  async getStatus(companyId: string, jobId: string) {
    const log = await this.logRepo.findOne({
      where: { jobId, companyId },
      order: { createdAt: 'DESC' } as any,
    });

    let bullJobState: string | null = null;
    let bullAttemptsMade = 0;
    let bullFailedReason: string | null = null;

    try {
      const bullJob = await this.notificationQueue.getJob(jobId);
      if (bullJob) {
        bullJobState = await bullJob.getState();
        bullAttemptsMade = bullJob.attemptsMade ?? 0;
        bullFailedReason = bullJob.failedReason ?? null;
      }
    } catch {
      // Job ya fue limpiado de Redis — usar solo el log de BD
    }

    if (!log && !bullJobState) {
      throw new NotFoundException(
        `No se encontró ningún envío con jobId "${jobId}" para esta empresa.`
      );
    }

    const dbStatus = log?.status ?? null;
    const effectiveState = this.resolveEffectiveState(dbStatus, bullJobState);
    // BullMQ usa attemptsMade=0 durante el 1er intento (incrementa al fallar).
    // Sumamos +1 para mostrarlo humanamente como "intento 1", "intento 2", etc.
    const displayAttempts = log?.attempts ?? (bullAttemptsMade + 1);

    return {
      success: true,
      jobId,
      status: effectiveState,
      statusDescription: this.describeStatus(effectiveState, displayAttempts, log?.errorMessage),
      log: log ? {
        id: log.id,
        channel: log.channel,
        recipient: log.recipient,
        attemptsMade: displayAttempts,
        createdAt: log.createdAt,
        errorMessage: log.errorMessage ?? null,
      } : null,
      queue: bullJobState
        ? {
          state: bullJobState,
          attemptsMade: bullAttemptsMade + 1,
          failedReason: bullFailedReason,
        }
        : {
          state: 'removed',
          note: 'Job ya procesado. Ver campo "log" para el resultado final.',
        },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTAR TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  async listTemplates(companyId: string, channel?: string) {
    const where: any = { company_id: companyId };
    if (channel) where.channel = channel.toUpperCase();

    const templates = await this.templateRepo.find({
      where,
      order: { channel: 'ASC', name: 'ASC' } as any,
    });

    return {
      success: true,
      count: templates.length,
      // Hint for the user on how to use the templates endpoint
      usage: 'Use templateAlias in POST /notifications/send. Fill all expectedVariables to avoid empty messages.',
      data: templates.map((t: any) => {
        const vars = this.extractPlaceholders(t.content ?? '');

        // Build a ready-to-use example request for this specific template
        const exampleVariables: Record<string, string> = {};
        vars.forEach((v: string) => { exampleVariables[v] = `<your_${v}>`; });

        return {
          id: t.id,
          name: t.name,
          channel: t.channel,
          // Use this value in the templateAlias field of POST /notifications/send
          templateAlias: (t.alias ?? '').toUpperCase(),
          // First 120 chars of the template content so you can see the placeholders
          contentPreview: (t.content ?? '').substring(0, 120) + ((t.content?.length ?? 0) > 120 ? '...' : ''),
          // Variables the template expects — you MUST send all of them to avoid empty messages
          expectedVariables: vars,
          // Copy-paste example — just replace <your_xxx> with real values
          exampleRequest: {
            channel: t.channel,
            templateAlias: (t.alias ?? '').toUpperCase(),
            recipient: t.channel === 'EMAIL' ? 'user@example.com' : '+591XXXXXXXXX',
            variables: Object.keys(exampleVariables).length > 0 ? exampleVariables : undefined,
            scheduling: { is_scheduled: false },
          },
        };
      }),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVADOS
  // ═══════════════════════════════════════════════════════════════════════════

  private resolveResendConfig(dto: SendUnifiedNotificationDto): { attempts: number; delayMs: number } {
    let attempts = (dto as any).resend?.attempts ?? 1;
    if (attempts > MAX_RESEND_ATTEMPTS) {
      this.logger.warn(`⚠️ ${attempts} intentos solicitados, límite es ${MAX_RESEND_ATTEMPTS}`);
      attempts = MAX_RESEND_ATTEMPTS;
    }

    let intervalMinutes = (dto as any).resend?.retryIntervalMinutes ?? MIN_RETRY_INTERVAL_MINUTES;
    if (intervalMinutes < MIN_RETRY_INTERVAL_MINUTES) intervalMinutes = MIN_RETRY_INTERVAL_MINUTES;
    if (intervalMinutes > MAX_RETRY_INTERVAL_MINUTES) intervalMinutes = MAX_RETRY_INTERVAL_MINUTES;

    const delayMs = intervalMinutes * 60 * 1000;
    this.logger.log(`🔁 Resend: ${attempts} intentos, ${intervalMinutes} min entre cada uno`);
    return { attempts, delayMs };
  }

  private resolveEffectiveState(dbStatus: string | null, bullState: string | null): string {
    if (dbStatus === 'SENT') return 'SENT';
    if (dbStatus === 'FAILED') return 'FAILED';
    if (bullState === 'completed') return 'SENT';
    if (bullState === 'failed') return 'FAILED';
    if (bullState === 'active') return 'SENDING';
    if (bullState === 'delayed') return 'WAITING_RETRY';
    if (bullState === 'waiting' || bullState === 'paused') return 'QUEUED';
    if (dbStatus === 'PENDING') return 'PENDING';
    return 'UNKNOWN';
  }

  private describeStatus(state: string, attemptsMade: number, errorMessage?: string | null): string {
    const att = attemptsMade > 0 ? ` (intento ${attemptsMade})` : '';
    switch (state) {
      case 'SENT': return '✅ Mensaje entregado exitosamente';
      case 'FAILED': {
        const cause = errorMessage && errorMessage.length > 0
          ? errorMessage
          : 'El servicio no está disponible en este momento. Intente más tarde.';
        return `❌ Falló tras ${attemptsMade} intento(s). ${cause}`;
      }
      case 'SENDING': return `🔄 Enviando ahora${att}...`;
      case 'WAITING_RETRY': return `⏳ Esperando reintento${att}...`;
      case 'QUEUED': return '📥 En cola, pendiente de procesamiento';
      case 'PENDING': return '⏳ Procesando...';
      case 'SCHEDULED': return '📅 Programado para envío futuro';
      default: return 'Estado desconocido — job puede haber sido limpiado de la cola';
    }
  }

  private extractPlaceholders(content: string): string[] {
    const matches = content.match(/\{\{([^}]+)\}\}/g) ?? [];
    return [...new Set(matches.map((m: string) => m.replace(/\{\{|\}\}/g, '').trim()))];
  }

}