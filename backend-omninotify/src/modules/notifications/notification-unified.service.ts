import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SendUnifiedNotificationDto } from './dto/send-unified.dto';
import { Template } from '../templates/entities/template.entity';
import { ScheduledNotification } from './entities/scheduled-notification.entity';
import { NotificationLog } from './entities/notification-log.entity';
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
  ) {}

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

    // 5️⃣ Decidir: ¿Es programado o inmediato?
    const isScheduled = dto.scheduling?.is_scheduled === true && dto.scheduling?.send_at;

    if (isScheduled) {
      return this.scheduleNotification(companyId, template, dto);
    } else {
      return this.sendImmediate(companyId, template, dto);
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
      template = await this.templateRepo.findOne({
        where: {
          company_id: companyId,
          alias: dto.templateAlias,
          channel: dto.channel,
        },
      });

      if (!template) {
        throw new NotFoundException(
          `Plantilla "${dto.templateAlias}" no encontrada para canal ${dto.channel}`
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
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
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
        hasAttachments: (dto.attachments?.length ?? 0) > 0,
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
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
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
        hasAttachments: (dto.attachments?.length ?? 0) > 0,
      },
    };
  }
}