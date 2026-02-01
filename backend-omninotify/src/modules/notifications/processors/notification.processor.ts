// src/modules/notifications/processors/notification.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';

import { SendNotificationDto, NotificationChannel } from '../dto/send-notification.dto';
import { ScheduledNotification } from '../entities/scheduled-notification.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { Template } from '../../templates/entities/template.entity';
import { TemplateProcessorService } from '../../templates/template-processor.service';
import { NexoWhatsappProvider } from '../providers/nexo-whatsapp.provider';
import { CompanyProviderConfig } from '../../providers/entities/company-provider-config.entity'; // <-- NUEVO

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(ScheduledNotification)
    private scheduledRepo: Repository<ScheduledNotification>,
    @InjectRepository(NotificationLog)
    private logsRepo: Repository<NotificationLog>,
    @InjectRepository(Template)
    private templateRepo: Repository<Template>,
    @InjectRepository(CompanyProviderConfig) // <-- NUEVO: Inyectar repositorio de configs
    private configRepo: Repository<CompanyProviderConfig>,
    
    private readonly templateProcessor: TemplateProcessorService,
    private readonly nexoWhatsapp: NexoWhatsappProvider,
  ) {
    super();
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  async process(job: Job<SendNotificationDto>): Promise<any> {
    const { channel, recipient, templateId, variables, companyId } = job.data;
    this.logger.log(`📨 Procesando ${channel} para: ${recipient}`);

    try {
      const template = await this.templateRepo.findOne({ where: { id: templateId } });
      if (!template) throw new Error(`Plantilla ${templateId} no encontrada`);

      const finalMessage = this.templateProcessor.process(template.content, variables || {});

      let result;

      if (channel === NotificationChannel.WHATSAPP) {
        // --- AQUÍ ESTÁ EL CAMBIO DINÁMICO ---
        
        // 1. Buscamos la configuración de la empresa para WhatsApp
        const providerConfig = await this.configRepo.findOne({
          where: { 
            companyId: companyId,
            provider: { name: 'NEXO_WHATSAPP' } // Asegúrate que en la tabla Provider el nombre sea este
          },
          relations: ['provider']
        });

        if (!providerConfig || !providerConfig.config?.token) {
          throw new Error(`Empresa ${companyId} no tiene configurado el token de WhatsApp (Nexo)`);
        }

        // 2. Usamos el token que viene de la base de datos
        const dbToken = providerConfig.config.token; 
        
        result = await this.nexoWhatsapp.send(dbToken, {
          para: recipient,
          mensaje: finalMessage
        });
        // ------------------------------------
      } 
      else if (channel === NotificationChannel.EMAIL) {
        result = await this.transporter.sendMail({
          from: process.env.SMTP_USER,
          to: recipient,
          subject: template.name,
          text: finalMessage,
        });
      }

      await this.saveLog(job.id, companyId, recipient, channel, 'SUCCESS');
      return { success: true, result };

    } catch (error) {
      this.logger.error(`❌ Error en job ${job.id}: ${error.message}`);
      await this.saveLog(job.id, companyId, recipient, channel, 'FAILED', error.message);
      throw error;
    }
  }

  private async saveLog(jobId: any, companyId: string, recipient: string, channel: any, status: string, error?: string) {
    const log = this.logsRepo.create({
      jobId: String(jobId),
      companyId: companyId,
      recipient: recipient,
      channel: channel,
      status: status as any,
      errorMessage: error,
    });
    await this.logsRepo.save(log);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Job ${job.id} falló: ${error.message}`);
  }
}