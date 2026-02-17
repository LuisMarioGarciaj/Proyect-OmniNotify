// src/modules/notifications/services/notification-unified.service.ts
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
   * Decide automáticamente:
   * - Si es scheduled → guarda en SCHEDULED_NOTIFICATION
   * - Si es inmediato → encola directo → se guarda en NOTIFICATION_LOGS al enviar
   */
  async send(companyId: string, dto: SendUnifiedNotificationDto) {
    this.logger.log(`📨 Enviando notificación: ${dto.channel} → ${dto.recipient}`);

    // 1️⃣ Resolver template (por alias o ID)
    const template = await this.resolveTemplate(companyId, dto);

    // 2️⃣ Validar destinatario según canal
    this.validateRecipient(dto.channel, dto.recipient);

    // 3️⃣ Decidir: ¿Es programado o inmediato?
    const isScheduled = dto.scheduling?.is_scheduled === true && dto.scheduling?.send_at;

    if (isScheduled) {
      // ✅ PROGRAMADO → Guardar en SCHEDULED_NOTIFICATION
      return this.scheduleNotification(companyId, template, dto);
    } else {
      // ✅ INMEDIATO → Encolar directo (se guardará en NOTIFICATION_LOGS al enviar)
      return this.sendImmediate(companyId, template, dto);
    }
  }

  /**
   * 🔍 Resolver template por alias O por ID (compatible)
   */
  private async resolveTemplate(companyId: string, dto: SendUnifiedNotificationDto): Promise<Template> {
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
        throw new NotFoundException(`Plantilla con ID "${dto.templateId}" no encontrada`);
      }
    } else {
      throw new BadRequestException('Debes proporcionar templateAlias o templateId');
    }

    return template;
  }

  /**
   * ✅ Validar destinatario según canal
   */
  private validateRecipient(channel: string, recipient: string): void {
    switch (channel) {
      case 'EMAIL':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipient)) {
          throw new BadRequestException('Email inválido');
        }
        break;

      case 'SMS':
      case 'WHATSAPP':
        const phoneRegex = /^\+?[1-9]\d{7,14}$/;
        if (!phoneRegex.test(recipient)) {
          throw new BadRequestException(
            'Número inválido. Formato esperado: +59176131645'
          );
        }
        break;
    }
  }

  /**
   * ⏰ Guardar en SCHEDULED_NOTIFICATION (programado)
   */
  private async scheduleNotification(
    companyId: string,
    template: Template,
    dto: SendUnifiedNotificationDto,
  ) {
    const scheduledAt = new Date(dto.scheduling!.send_at!);
    const now = new Date();

    if (scheduledAt <= now) {
      throw new BadRequestException('La fecha de programación debe ser futura');
    }

    // Guardar en tabla SCHEDULED_NOTIFICATION
    const scheduled = this.scheduledRepo.create({
      companyId: companyId,
      templateId: template.id,
      channel: dto.channel,
      recipient: dto.recipient,
      variables: dto.variables || {},
      scheduledAt: scheduledAt,
      status: ScheduledNotificationStatus.SCHEDULED,
    });


    await this.scheduledRepo.save(scheduled);

    // Encolar con delay
    const delay = scheduledAt.getTime() - now.getTime();
    
    await this.notificationQueue.add(
      'send-notification',
      {
        scheduledNotificationId: scheduled.id, // ✅ IMPORTANTE
        companyId,
        templateId: template.id,
        channel: dto.channel,
        recipient: dto.recipient,
        variables: dto.variables,
        attachments: dto.attachments,
      },
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
        id: scheduled.id,
        channel: dto.channel,
        recipient: dto.recipient,
        scheduledAt: scheduledAt.toISOString(),
        status: 'SCHEDULED',
      },
    };
  }

  /**
   * 🚀 Envío inmediato (encolar sin guardar en BD aún)
   */
  private async sendImmediate(
    companyId: string,
    template: Template,
    dto: SendUnifiedNotificationDto,
  ) {
    // Encolar para envío inmediato
    const job = await this.notificationQueue.add(
      'send-notification',
      {
        companyId,
        templateId: template.id,
        channel: dto.channel,
        recipient: dto.recipient,
        variables: dto.variables || {},
        attachments: dto.attachments,
        metadata: dto.metadata,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    this.logger.log(`🚀 Encolado para envío inmediato: Job ${job.id}`);

    // ✅ El worker guardará en NOTIFICATION_LOGS cuando se envíe

    return {
      success: true,
      message: 'Notificación encolada para envío inmediato',
      data: {
        jobId: job.id,
        channel: dto.channel,
        recipient: dto.recipient,
        status: 'QUEUED',
      },
    };
  }
}