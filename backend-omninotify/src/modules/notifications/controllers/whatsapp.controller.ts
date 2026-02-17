import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { SendNotificationDto, NotificationChannel } from '../dto/send-notification.dto';
import { ScheduledNotification, ScheduledNotificationStatus } from '../entities/scheduled-notification.entity';
import { WhatsappProvider } from '../providers/whatsapp/whatsapp.provider';

interface SendWhatsAppRequest {
  to: string;
  body: string;
  companyId: string;
  companyName?: string;
  templateId?: string;
  schedule?: string;
  variables?: Record<string, string>;
}

interface SendWhatsAppMediaRequest {
  variables: Record<string, any> | undefined;
  to: string;
  body: string;
  mediaUrl: string;
  mediaType?: string;
  companyId: string;
  companyName?: string;
  templateId?: string;
  schedule?: string;
}

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsappProvider: WhatsappProvider,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectRepository(ScheduledNotification)
    private scheduledNotificationRepository: Repository<ScheduledNotification>,
  ) {
    console.log('✅ WhatsappController inicializado con BullMQ');
  }

  // ==================== ENDPOINTS PÚBLICOS ====================

  /**
   * Envía un mensaje de texto simple por WhatsApp
   * POST /api/whatsapp/send
   */
  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendMessage(@Body() body: SendWhatsAppRequest) {
    try {
      this.logger.log(`📱 Recibida solicitud de envío a ${body.to}`);
      
      // Validaciones básicas
      if (!body.to || !body.body || !body.companyId) {
        throw new BadRequestException('Campos requeridos: to, body, companyId');
      }

      // Crear DTO
      const dto: SendNotificationDto = {
        recipient: body.to,
        channel: NotificationChannel.WHATSAPP,
        companyId: body.companyId,
        companyName: body.companyName,
        templateId: body.templateId || 'simple',
        html: body.body,
        text: body.body,
        variables: body.variables,
        scheduledAt: body.schedule,
      };

      // Enqueue en BullMQ
      const job = await this.notificationsQueue.add(
        'send-notification',
        dto,
        {
          attempts: parseInt(process.env.QUEUE_ATTEMPTS || '3'),
          backoff: {
            type: 'exponential',
            delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '2000'),
          },
        }
      );

      return {
        success: true,
        message: 'Mensaje WhatsApp encolado para procesamiento',
        data: {
          jobId: job.id,
          recipient: body.to,
          channel: 'WHATSAPP',
          companyId: body.companyId,
          status: 'queued',
          timestamp: new Date().toISOString(),
        },
        checkStatus: `/api/whatsapp/queue/job/${job.id}`,
      };
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error enviando mensaje WhatsApp');
    }
  }

  /**
   * Envía un mensaje con media (imagen, documento, etc)
   * POST /api/whatsapp/send-media
   */
  @Post('send-media')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendMediaMessage(@Body() body: SendWhatsAppMediaRequest) {
    try {
      this.logger.log(`📸 Recibida solicitud de envío con media a ${body.to}`);

      // Validaciones
      if (!body.to || !body.body || !body.mediaUrl || !body.companyId) {
        throw new BadRequestException('Campos requeridos: to, body, mediaUrl, companyId');
      }

      const dto: SendNotificationDto = {
        recipient: body.to,
        channel: NotificationChannel.WHATSAPP,
        companyId: body.companyId,
        companyName: body.companyName,
        templateId: body.templateId || 'media',
        html: body.body,
        text: body.body,
        variables: {
          ...body.variables,
          mediaUrl: body.mediaUrl,
          mediaType: body.mediaType,
        },
        scheduledAt: body.schedule,
      };

      const job = await this.notificationsQueue.add(
        'send-notification',
        dto,
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        }
      );

      return {
        success: true,
        message: 'Mensaje WhatsApp con media encolado',
        data: {
          jobId: job.id,
          recipient: body.to,
          channel: 'WHATSAPP',
          mediaUrl: body.mediaUrl,
          status: 'queued',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error enviando media por WhatsApp');
    }
  }

  /**
   * Envía un mensaje usando template
   * POST /api/whatsapp/send-template
   */
  @Post('send-template')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendTemplate(@Body() body: {
    to: string;
    templateName: string;
    variables?: Record<string, string>;
    companyId: string;
    companyName?: string;
    schedule?: string;
  }) {
    try {
      this.logger.log(`📋 Enviando template ${body.templateName} a ${body.to}`);

      if (!body.to || !body.templateName || !body.companyId) {
        throw new BadRequestException('Campos requeridos: to, templateName, companyId');
      }

      const dto: SendNotificationDto = {
        recipient: body.to,
        channel: NotificationChannel.WHATSAPP,
        companyId: body.companyId,
        companyName: body.companyName,
        templateId: body.templateName,
        variables: body.variables,
        scheduledAt: body.schedule,
        html: '',
        text: '',
      };

      const job = await this.notificationsQueue.add(
        'send-notification',
        dto,
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        }
      );

      return {
        success: true,
        message: 'Template WhatsApp encolado',
        data: {
          jobId: job.id,
          recipient: body.to,
          templateName: body.templateName,
          status: 'queued',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error enviando template WhatsApp');
    }
  }

  /**
   * Envía un mensaje programado
   * POST /api/whatsapp/send-scheduled
   */
  @Post('send-scheduled')
  @HttpCode(HttpStatus.OK)
  async sendScheduled(@Body() body: SendWhatsAppRequest & { schedule: string }) {
    try {
      this.logger.log(`📅 Programando mensaje para ${body.to}`);

      if (!body.schedule) {
        throw new BadRequestException('El campo "schedule" (fecha/hora) es requerido');
      }

      // Validar fecha
      const scheduledDate = new Date(body.schedule);
      const now = new Date();

      if (scheduledDate <= now) {
        throw new BadRequestException('La fecha programada debe ser en el futuro');
      }

      if (scheduledDate > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
        throw new BadRequestException('La programación no puede exceder 30 días');
      }

      const delay = scheduledDate.getTime() - now.getTime();

      const dto: SendNotificationDto = {
        recipient: body.to,
        channel: NotificationChannel.WHATSAPP,
        companyId: body.companyId,
        companyName: body.companyName,
        templateId: body.templateId || 'scheduled',
        html: body.body,
        text: body.body,
        variables: body.variables,
        scheduledAt: body.schedule,
      };

      const jobId = `sch_${uuidv4().substring(0, 20)}`;

      const job = await this.notificationsQueue.add(
        'send-notification',
        dto,
        {
          delay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          jobId: jobId,
        }
      );

      // Guardar en BD
      const scheduledNotification = this.scheduledNotificationRepository.create({
        id: job.id!,
        recipient: body.to,
        companyId: body.companyId,
        templateId: body.templateId || 'scheduled',
        channel: NotificationChannel.WHATSAPP,
        variables: body.variables || {},
        scheduledAt: scheduledDate,
        status: ScheduledNotificationStatus.SCHEDULED,
      });

      await this.scheduledNotificationRepository.save(scheduledNotification);

      return {
        success: true,
        message: 'Mensaje WhatsApp programado exitosamente',
        data: {
          jobId: job.id,
          recipient: body.to,
          scheduledAt: scheduledDate.toISOString(),
          status: 'SCHEDULED',
          companyId: body.companyId,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error programando mensaje WhatsApp');
    }
  }

  /**
   * Obtiene mensajes programados de una empresa
   * GET /api/whatsapp/scheduled/:companyId
   */
  @Get('scheduled/:companyId')
  @HttpCode(HttpStatus.OK)
  async getScheduledMessages(@Param('companyId') companyId: string) {
    try {
      if (!companyId) {
        throw new BadRequestException('companyId es requerido');
      }

      const notifications = await this.scheduledNotificationRepository
        .createQueryBuilder('sn')
        .where('sn.companyId = :companyId', { companyId })
        .andWhere('sn.channel = :channel', { channel: NotificationChannel.WHATSAPP })
        .andWhere('sn.status = :status', { status: ScheduledNotificationStatus.SCHEDULED })
        .orderBy('sn.scheduledAt', 'ASC')
        .getMany();

      return {
        success: true,
        data: notifications,
        count: notifications.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error obteniendo mensajes programados');
    }
  }

  /**
   * Cancela un mensaje programado
   * DELETE /api/whatsapp/scheduled/:id
   */
  @Delete('scheduled/:id')
  @HttpCode(HttpStatus.OK)
  async cancelScheduled(@Param('id') id: string) {
    try {
      if (!id) {
        throw new BadRequestException('ID de notificación requerido');
      }

      const notification = await this.scheduledNotificationRepository
        .createQueryBuilder('sn')
        .where('sn.id = :id', { id })
        .andWhere('sn.status = :status', { status: ScheduledNotificationStatus.SCHEDULED })
        .getOne();

      if (!notification) {
        throw new BadRequestException(
          'Notificación programada no encontrada o ya fue enviada'
        );
      }

      // Cancelar job en BullMQ
      try {
        const job = await this.notificationsQueue.getJob(id);
        if (job) {
          await job.remove();
          this.logger.log(`🗑️ Job cancelado en BullMQ: ${id}`);
        }
      } catch (err: any) {
        this.logger.warn(`⚠️ No se pudo cancelar job ${id}:`, err.message);
      }

      // Actualizar estado en BD
      notification.status = ScheduledNotificationStatus.CANCELLED;
      await this.scheduledNotificationRepository.save(notification);

      return {
        success: true,
        message: 'Mensaje programado cancelado exitosamente',
        data: {
          id,
          status: 'CANCELLED',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error cancelando mensaje programado');
    }
  }

  /**
   * Obtiene el estado de un job
   * GET /api/whatsapp/queue/job/:jobId
   */
  @Get('queue/job/:jobId')
  @HttpCode(HttpStatus.OK)
  async getJobStatus(@Param('jobId') jobId: string) {
    try {
      if (!jobId) {
        throw new BadRequestException('jobId es requerido');
      }

      const job = await this.notificationsQueue.getJob(jobId);

      if (!job) {
        throw new BadRequestException(`Job ${jobId} no encontrado`);
      }

      const state = await job.getState();

      return {
        success: true,
        jobId,
        state,
        progress: job.progress,
        data: job.data,
        timestamps: {
          created: new Date(job.timestamp),
          processed: job.processedOn ? new Date(job.processedOn) : null,
          finished: job.finishedOn ? new Date(job.finishedOn) : null,
        },
        attempts: job.attemptsMade,
        failedReason: job.failedReason,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtiene estadísticas de la cola
   * GET /api/whatsapp/queue/stats
   */
  @Get('queue/stats')
  @HttpCode(HttpStatus.OK)
  async getQueueStats() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.notificationsQueue.getWaitingCount(),
        this.notificationsQueue.getActiveCount(),
        this.notificationsQueue.getCompletedCount(),
        this.notificationsQueue.getFailedCount(),
        this.notificationsQueue.getDelayedCount(),
      ]);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        queue: 'notifications',
        channel: 'WHATSAPP',
        counts: {
          waiting,
          active,
          completed,
          failed,
          delayed,
          total: waiting + active + completed + failed + delayed,
        },
        config: {
          concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
          attempts: parseInt(process.env.QUEUE_ATTEMPTS || '3'),
          backoff: parseInt(process.env.QUEUE_BACKOFF_DELAY || '2000'),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Error obteniendo stats de la cola',
        details: error.message,
      };
    }
  }

  /**
   * Webhook para recibir eventos de Twilio
   * POST /api/whatsapp/webhook
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: any) {
    try {
      this.logger.log(`📩 Webhook recibido de Twilio: ${body.MessageStatus}`);

      // Validar que sea una solicitud legítima de Twilio
      // TODO: Implementar validación de firma de Twilio

      const { MessageSid, MessageStatus, To, From, ErrorCode, ErrorMessage } = body;

      // Aquí puedes:
      // 1. Actualizar estado en BD
      // 2. Guardar logs
      // 3. Disparar eventos

      this.logger.log(`✅ Evento procesado: ${MessageStatus} para ${MessageSid}`);

      return {
        success: true,
        messageSid: MessageSid,
        status: MessageStatus,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error('❌ Error procesando webhook:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Health check del servicio
   * GET /api/whatsapp/health
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  healthCheck() {
    return {
      status: 'healthy',
      service: 'whatsapp',
      provider: 'twilio',
      enabled: this.whatsappProvider.isAvailable(),
      features: ['send-text', 'send-media', 'send-template', 'scheduled', 'webhooks'],
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      queue: {
        provider: 'BullMQ',
        redis: `${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
        concurrency: process.env.QUEUE_CONCURRENCY || '5',
      },
      providerInfo: this.whatsappProvider.getProviderInfo(),
    };
  }

  // ==================== MÉTODOS AUXILIARES ====================

  private buildErrorResponse(error: any, message: string) {
    this.logger.error(`❌ ${message}: ${error.message}`);

    return {
      success: false,
      message,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}