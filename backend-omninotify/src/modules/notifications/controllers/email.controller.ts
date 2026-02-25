import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Query, 
  Param,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Delete,
  Res,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { NotificationsService } from '../notifications.service';
import { SendNotificationDto, NotificationChannel } from '../dto/send-notification.dto';
import { ScheduledNotification, ScheduledNotificationStatus } from '../entities/scheduled-notification.entity';

interface TestEmailRequest {
  to: string;
  provider: 'sendgrid' | 'smtp';
  apiKey?: string;
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  };
  metadata?: {
    companyName?: string;
    companyLogo?: string;
    testType?: string;
    includeLogo: boolean;
    logoSize?: number;
    companyId?: string;
  };
}

interface EmailConfig {
  provider: 'sendgrid' | 'smtp';
  apiKey?: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
    fromEmail: string;
    fromName: string;
  };
}

interface EmailContentParams {
  companyName: string;
  companyId?: string;
  companyLogo?: string | null;
  testType: string;
  includeLogo: boolean;
}

interface LogoData {
  companyId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  filePath: string;
  fileUrl: string;
  base64?: string;
  size: number;
  originalSize: number;
  uploadedAt: string;
  lastUpdated: string;
  publicUrl: string;
}

// Constantes
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'logos');
const LOGOS_DB_PATH = path.join(UPLOAD_DIR, 'database.json');
const LOGO_COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];

// Configuración de almacenamiento
const storage = diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, callback) => {
    const filename = uuidv4();
    const extension = path.parse(file.originalname).ext.toLowerCase();
    callback(null, `${filename}${extension}`);
  },
});

const logoFileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(new BadRequestException('Solo se permiten imágenes (JPEG, PNG, GIF, SVG)'), false);
  }
  callback(null, true);
};

@Controller('email')
export class EmailController {
  private readonly logger = new Logger(EmailController.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectRepository(ScheduledNotification)
    private scheduledNotificationRepository: Repository<ScheduledNotification>,
  ) {
    console.log('✅ EmailController inicializado con BullMQ');
  }

  // ==================== ENDPOINTS PÚBLICOS ====================

  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendEmail(@Body() dto: SendNotificationDto) {
    dto.channel = NotificationChannel.EMAIL;
    
    // 🔥 ASEGURAR QUE CONTENT ESTÉ DEFINIDO
    if (!dto.content && dto.html) {
      dto.content = dto.html;
    }
    
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
      message: 'Email encolado para procesamiento',
      jobId: job.id,
      timestamp: new Date().toISOString(),
      status: 'queued',
      checkStatus: `/api/email/queue/job/${job.id}`,
    };
  }

  @Post('send-template')
  @HttpCode(HttpStatus.OK)
  async sendTemplateEmail(@Body() body: {
    to: string;
    subject: string;
    html: string;
    text: string;
    companyId: string;
    companyName?: string;
    companyLogo?: string;
    templateId?: string;
    schedule?: string;
    variables?: Record<string, string>;
  }) {
    try {
      this.logger.log('📧 ENVIANDO TEMPLATE DE EMAIL');
      
      // Validar fecha de programación si existe
      let scheduledDate: Date | null = null;
      if (body.schedule) {
        scheduledDate = new Date(body.schedule);
        const now = new Date();
        
        if (scheduledDate <= now) {
          throw new BadRequestException('La fecha programada debe ser futura');
        }
        
        if (scheduledDate > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
          throw new BadRequestException('La programación no puede exceder 30 días');
        }
      }
      
      // 🔥 CORREGIDO: Agregar content usando html
      const dto: SendNotificationDto = {
        recipient: body.to,
        subject: body.subject,
        html: body.html,
        text: body.text,
        content: body.html, // <-- AGREGADO: content igual que html (¡CRÍTICO!)
        channel: NotificationChannel.EMAIL,
        companyId: body.companyId,
        companyName: body.companyName,
        variables: body.variables,
        scheduledAt: body.schedule,
        templateId: body.templateId || 'custom',
      };

      // Calcular delay si hay programación
      let delay = 0;
      if (scheduledDate) {
        const now = new Date();
        delay = scheduledDate.getTime() - now.getTime();
      }

      // Usar ID más corto para evitar problemas de longitud en BD
      const jobId = scheduledDate ? `sch_${uuidv4().substring(0, 20)}` : `imm_${uuidv4().substring(0, 20)}`;
      
      const job = await this.notificationsQueue.add(
        'send-notification',
        dto,
        {
          delay: delay > 0 ? delay : 0,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          jobId: jobId,
        }
      );

      // Guardar en base de datos si está programado
      if (scheduledDate) {
        const scheduledNotification = this.scheduledNotificationRepository.create({
          id: job.id!,
          recipient: body.to,
          companyId: body.companyId,
          templateId: body.templateId || 'custom',
          channel: NotificationChannel.EMAIL,
          variables: body.variables || {},
          scheduledAt: scheduledDate,
          status: ScheduledNotificationStatus.SCHEDULED,
        });
        
        await this.scheduledNotificationRepository.save(scheduledNotification);
      }

      return {
        success: true,
        message: scheduledDate ? 'Email template programado exitosamente' : 'Email template encolado exitosamente',
        data: {
          jobId: job.id,
          scheduledAt: scheduledDate ? scheduledDate.toISOString() : null,
          recipient: body.to,
          templateId: body.templateId,
          companyId: body.companyId,
          status: scheduledDate ? 'SCHEDULED' : 'QUEUED',
          maskedSender: `${body.companyName || 'OmniNotify'} <noreply@${body.companyName?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'omninotify'}.com>`,
        },
      };
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error enviando template');
    }
  }

  @Post('send-notification')
  @HttpCode(HttpStatus.OK)
  async sendNotification(@Body() body: {
    to: string;
    subject: string;
    templateId: string;
    variables?: Record<string, string>;
    companyId: string;
    schedule?: string;
    html?: string;
    text?: string;
  }) {
    try {
      this.logger.log('📧 ENVIANDO NOTIFICACIÓN');
      
      // Validar fecha de programación si existe
      let scheduledDate: Date | null = null;
      if (body.schedule) {
        scheduledDate = new Date(body.schedule);
        const now = new Date();
        
        if (scheduledDate <= now) {
          throw new BadRequestException('La fecha programada debe ser futura');
        }
        
        if (scheduledDate > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
          throw new BadRequestException('La programación no puede exceder 30 días');
        }
      }

      // Generar contenido si no se proporciona
      let htmlContent = body.html;
      let textContent = body.text;
      
      if (!htmlContent || !textContent) {
        const content = this.generateNotificationContent(body);
        htmlContent = content.htmlContent;
        textContent = content.textContent;
      }

      // 🔥 CORREGIDO: Agregar content usando html
      const dto: SendNotificationDto = {
        recipient: body.to,
        subject: body.subject,
        html: htmlContent!,
        text: textContent!,
        content: htmlContent!, // <-- AGREGADO: content igual que html (¡CRÍTICO!)
        channel: NotificationChannel.EMAIL,
        companyId: body.companyId,
        variables: body.variables,
        scheduledAt: body.schedule,
        templateId: body.templateId,
      };

      // Calcular delay si hay programación
      let delay = 0;
      if (scheduledDate) {
        const now = new Date();
        delay = scheduledDate.getTime() - now.getTime();
      }

      // Usar ID más corto para programaciones
      const jobId = scheduledDate ? `sch_${uuidv4().substring(0, 20)}` : `imm_${uuidv4().substring(0, 20)}`;
      
      const job = await this.notificationsQueue.add(
        'send-notification',
        dto,
        {
          delay: delay > 0 ? delay : 0,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          jobId: jobId,
        }
      );

      // Guardar en BD si está programado
      if (scheduledDate) {
        const scheduledNotification = this.scheduledNotificationRepository.create({
          id: job.id!,
          recipient: body.to,
          companyId: body.companyId,
          templateId: body.templateId,
          channel: NotificationChannel.EMAIL,
          variables: body.variables || {},
          scheduledAt: scheduledDate,
          status: ScheduledNotificationStatus.SCHEDULED,
        });
        
        await this.scheduledNotificationRepository.save(scheduledNotification);
      }

      return {
        success: true,
        message: scheduledDate ? 'Notificación programada exitosamente' : 'Notificación encolada exitosamente',
        data: {
          jobId: job.id,
          recipient: body.to,
          templateId: body.templateId,
          companyId: body.companyId,
          scheduled: !!scheduledDate,
          scheduledAt: scheduledDate ? scheduledDate.toISOString() : null,
          status: scheduledDate ? 'SCHEDULED' : 'QUEUED',
        },
      };
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error enviando notificación');
    }
  }

  @Post('send-scheduled')
  @HttpCode(HttpStatus.OK)
  async sendScheduledNotification(@Body() body: {
    to: string;
    subject: string;
    html: string;
    text: string;
    templateId: string;
    companyId: string;
    companyName?: string;
    variables?: Record<string, string>;
    schedule: string;
  }) {
    try {
      this.logger.log('📅 PROGRAMANDO NOTIFICACIÓN');
      
      // Validar fecha de programación
      const scheduledDate = new Date(body.schedule);
      const now = new Date();
      
      if (scheduledDate <= now) {
        throw new BadRequestException('La fecha de programación debe ser futura');
      }
      
      if (scheduledDate > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
        throw new BadRequestException('La programación no puede exceder 30 días');
      }
      
      const delay = scheduledDate.getTime() - now.getTime();
      
      // 🔥 CORREGIDO: Agregar content usando html
      const dto: SendNotificationDto = {
        recipient: body.to,
        subject: body.subject,
        html: body.html,
        text: body.text,
        content: body.html, // <-- AGREGADO: content igual que html (¡CRÍTICO!)
        channel: NotificationChannel.EMAIL,
        companyId: body.companyId,
        companyName: body.companyName,
        variables: body.variables,
        scheduledAt: body.schedule,
        templateId: body.templateId,
      };

      // Usar ID más corto para evitar problemas de longitud
      const jobId = `sch_${uuidv4().substring(0, 20)}`;
      
      const job = await this.notificationsQueue.add(
        'send-notification',
        dto,
        {
          delay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          jobId: jobId,
        }
      );

      // Guardar en base de datos
      const scheduledNotification = this.scheduledNotificationRepository.create({
        id: job.id!,
        recipient: body.to,
        companyId: body.companyId,
        templateId: body.templateId,
        channel: NotificationChannel.EMAIL,
        variables: body.variables || {},
        scheduledAt: scheduledDate,
        status: ScheduledNotificationStatus.SCHEDULED,
      });
      
      await this.scheduledNotificationRepository.save(scheduledNotification);

      return {
        success: true,
        message: 'Notificación programada exitosamente',
        data: {
          id: job.id,
          scheduledAt: scheduledDate,
          recipient: body.to,
          templateId: body.templateId,
          companyId: body.companyId,
          status: 'SCHEDULED',
          jobId: job.id,
        },
      };
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error programando notificación');
    }
  }

  @Get('scheduled/:companyId')
  @HttpCode(HttpStatus.OK)
  async getScheduledNotifications(@Param('companyId') companyId: string) {
    try {
      const notifications = await this.scheduledNotificationRepository
        .createQueryBuilder('sn')
        .where('sn.companyId = :companyId', { companyId })
        .andWhere('sn.status = :status', { status: ScheduledNotificationStatus.SCHEDULED })
        .orderBy('sn.scheduledAt', 'ASC')
        .getMany();
      
      return {
        success: true,
        data: notifications,
        count: notifications.length,
      };
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error obteniendo notificaciones programadas');
    }
  }

  @Delete('scheduled/:id')
  @HttpCode(HttpStatus.OK)
  async cancelScheduledNotification(@Param('id') id: string) {
    try {
      const notification = await this.scheduledNotificationRepository
        .createQueryBuilder('sn')
        .where('sn.id = :id', { id })
        .andWhere('sn.status = :status', { status: ScheduledNotificationStatus.SCHEDULED })
        .getOne();
      
      if (!notification) {
        throw new BadRequestException('Notificación programada no encontrada o ya fue enviada');
      }
      
      // Cancelar job en BullMQ
      try {
        const job = await this.notificationsQueue.getJob(id);
        if (job) {
          await job.remove();
          this.logger.log(`🗑️ Job cancelado en BullMQ: ${id}`);
        }
      } catch (error: any) {
        this.logger.warn(`⚠️ No se pudo cancelar job ${id} en BullMQ:`, error.message);
      }
      
      // Actualizar estado en BD
      notification.status = ScheduledNotificationStatus.CANCELLED;
      await this.scheduledNotificationRepository.save(notification);
      
      return {
        success: true,
        message: 'Notificación programada cancelada exitosamente',
        data: { id, status: 'CANCELLED' },
      };
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error cancelando notificación programada');
    }
  }

  @Get('queue/job/:jobId')
  @HttpCode(HttpStatus.OK)
  async getJobStatus(@Param('jobId') jobId: string) {
    try {
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

  // ==================== ENDPOINTS DE LOGO ====================

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testEmail(@Body() body: TestEmailRequest) {
    this.logSection('📥 TEST DE EMAIL');
    
    this.validateTestRequest(body);
    
    const { logoToUse, logoSource, logoSizeKB } = await this.processLogo(body);
    const maskedConfig = this.maskGmailSender(body);
    
    this.logEmailDetails(body, maskedConfig, logoSource, logoSizeKB);
    
    const emailParams: EmailContentParams = {
      companyName: body.metadata?.companyName || 'OmniNotify',
      companyId: body.metadata?.companyId,
      companyLogo: logoToUse,
      testType: body.metadata?.testType || 'connection_test',
      includeLogo: !!logoToUse,
    };
    
    const emailContent = this.generateTestEmailHTML(emailParams);
    const config = this.buildEmailConfig(body, maskedConfig);
    const payload = {
      to: body.to,
      subject: `Prueba de Email - ${emailParams.companyName}`,
      html: emailContent.html,
      text: emailContent.text,
    };
    
    try {
      const result = await this.sendEmailWithConfig(config, payload, body.metadata);
      return this.buildSuccessResponse(result, body, maskedConfig, emailParams, logoSource, logoSizeKB);
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error enviando email de prueba');
    }
  }

  @Get('logo-image/:companyId')
  @HttpCode(HttpStatus.OK)
  async serveLogoImage(@Param('companyId') companyId: string, @Res() res: Response) {
    try {
      if (!companyId) return res.status(400).send('Company ID requerido');
      
      const logoData = await this.getLogoFromStorage(companyId);
      
      if (logoData?.filePath && fs.existsSync(logoData.filePath)) {
        const contentType = this.getContentTypeFromExtension(logoData.filePath);
        this.setImageHeaders(res, contentType);
        return res.sendFile(logoData.filePath);
      }
      
      const placeholderSVG = this.generatePlaceholderSVG(companyId);
      this.setImageHeaders(res, 'image/svg+xml');
      return res.send(placeholderSVG);
    } catch (error) {
      const errorSVG = this.generateErrorSVG();
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(errorSVG);
    }
  }

  @Post('upload-logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage,
      fileFilter: logoFileFilter,
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  @HttpCode(HttpStatus.OK)
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { companyId: string }
  ) {
    try {
      this.logSection('📤 UPLOAD DE LOGO');
      
      if (!file) {
        throw new BadRequestException('No se recibió ningún archivo');
      }
      
      console.log('🔍 ARCHIVO RECIBIDO:', {
        nombre: file.originalname,
        tamaño: file.size,
        tipo: file.mimetype,
        buffer: file.buffer?.length || 0,
        path: file.path || 'No disponible'
      });
      
      this.validateUploadRequest(file, body);
      this.validateFileSize(file);
      
      const fileBuffer = this.getFileBuffer(file);
      const base64 = this.convertToBase64(file, fileBuffer);
      
      console.log('📊 DATOS PROCESADOS:', {
        bufferSize: fileBuffer.length,
        base64Length: base64.length,
        companyId: body.companyId
      });
      
      await this.deleteExistingLogo(body.companyId);
      const savedFilePath = await this.saveLogoFile(file, fileBuffer, body.companyId);
      const logoData = await this.saveLogoToStorage(
        body.companyId, 
        { ...file, path: savedFilePath }, 
        base64
      );
      
      console.log('✅ LOGO SUBIDO EXITOSAMENTE:', {
        ruta: savedFilePath,
        id: body.companyId,
        tamañoBase64: base64.length
      });
      
      return this.buildUploadSuccessResponse(logoData, fileBuffer, base64);
      
    } catch (error: any) {
      if (file?.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
          console.log('🗑️ Archivo temporal eliminado debido a error');
        } catch (unlinkError) {
          console.error('❌ Error eliminando archivo temporal:', unlinkError);
        }
      }
      
      console.error('='.repeat(50));
      console.error('❌ ERROR EN UPLOAD LOGO');
      console.error('Mensaje:', error.message);
      console.error('Stack:', error.stack?.split('\n')[0]);
      console.error('='.repeat(50));
      
      return {
        success: false,
        message: 'Error subiendo logo',
        error: error.message,
      };
    }
  }

  @Get('logo/:companyId')
  @HttpCode(HttpStatus.OK)
  async getLogo(@Param('companyId') companyId: string) {
    try {
      this.validateCompanyId(companyId);
      
      const logoData = await this.getLogoFromStorage(companyId);
      
      if (logoData) {
        const validatedLogo = await this.validateAndRegenerateLogo(logoData);
        return this.buildLogoResponse(validatedLogo, true);
      }
      
      return this.buildLogoResponse({ companyId } as any, false);
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error obteniendo logo');
    }
  }

  @Delete('logo/:companyId')
  @HttpCode(HttpStatus.OK)
  async deleteLogo(@Param('companyId') companyId: string) {
    try {
      this.validateCompanyId(companyId);
      
      const logoData = await this.getLogoFromStorage(companyId);
      if (logoData?.filePath && fs.existsSync(logoData.filePath)) {
        fs.unlinkSync(logoData.filePath);
      }
      
      await this.deleteLogoFromStorage(companyId);
      
      return {
        success: true,
        message: 'Logo eliminado exitosamente',
        data: { companyId, deleted: true, timestamp: new Date().toISOString() },
      };
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error eliminando logo');
    }
  }

  @Get('stats/:companyId')
  @HttpCode(HttpStatus.OK)
  async getStats(@Param('companyId') companyId: string, @Query('days') days: string) {
    try {
      this.validateCompanyId(companyId);
      return this.notificationsService.getStats(companyId);
    } catch (error: any) {
      return this.buildErrorResponse(error, 'Error obteniendo estadísticas');
    }
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  healthCheck() {
    return {
      status: 'healthy',
      service: 'email',
      timestamp: new Date().toISOString(),
      features: [
        'test-email', 
        'logo-support', 
        'masked-sender', 
        'smtp', 
        'sendgrid', 
        'logo-backend-storage', 
        'logo-image-public', 
        'scheduled-emails',
        'bullmq-queue',
        'redis-persistence',
      ],
      version: '2.1.0',
      limits: {
        bodySize: '10MB',
        fileUpload: '5MB',
        logoBase64: 'sin límite (se devuelve original)',
        scheduleDays: '30 días máximo',
        queueJobs: '1000 concurrentes',
      },
      queue: {
        provider: 'BullMQ',
        redis: `${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
        concurrency: process.env.QUEUE_CONCURRENCY || '5',
      },
    };
  }

  // ==================== MÉTODOS AUXILIARES PRIVADOS ====================

  // Métodos de validación
  private validateTestRequest(body: TestEmailRequest) {
    if (!body) throw new BadRequestException('El cuerpo de la solicitud está vacío');
    if (!body.to) throw new BadRequestException('El campo "to" es requerido');
    if (!body.provider) throw new BadRequestException('El campo "provider" es requerido');
  }

  private validateUploadRequest(file: Express.Multer.File, body: { companyId: string }) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    if (!body.companyId) throw new BadRequestException('El campo "companyId" es requerido');
  }

  private validateFileSize(file: Express.Multer.File) {
    if (!file.size || file.size === 0) {
      throw new BadRequestException('El archivo está vacío o no tiene contenido válido');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('La imagen debe ser menor a 5MB');
    }
  }

  private validateCompanyId(companyId: string) {
    if (!companyId) throw new BadRequestException('companyId es requerido');
  }

  // Métodos de logo
  private async processLogo(body: TestEmailRequest) {
    let logoToUse: string | null = null;
    let logoSource = 'none';
    let logoSizeKB = 0;

    if (body.metadata?.companyId) {
      const logoFromBackend = await this.getLogoFromStorage(body.metadata.companyId);
      if (logoFromBackend?.base64 && this.isValidBase64(logoFromBackend.base64)) {
        logoToUse = logoFromBackend.base64;
        logoSource = 'backend';
        logoSizeKB = Math.round(logoFromBackend.base64.length / 1024);
      }
    }

    if (!logoToUse && body.metadata?.companyLogo && this.isValidBase64(body.metadata.companyLogo)) {
      const frontendLogoSizeKB = Math.round(body.metadata.companyLogo.length / 1024);
      if (frontendLogoSizeKB < 30) {
        logoToUse = body.metadata.companyLogo;
        logoSource = 'frontend';
        logoSizeKB = frontendLogoSizeKB;
      }
    }

    return { logoToUse, logoSource, logoSizeKB };
  }

  private getFileBuffer(file: Express.Multer.File): Buffer {
    if (file.buffer && file.buffer.length > 0) return file.buffer;
    if (file.path && fs.existsSync(file.path)) return fs.readFileSync(file.path);
    throw new BadRequestException('El archivo está vacío o no se pudo leer');
  }

  private convertToBase64(file: Express.Multer.File, fileBuffer: Buffer): string {
    return `data:${file.mimetype};base64,${fileBuffer.toString('base64')}`;
  }

  private async deleteExistingLogo(companyId: string) {
    const existingLogo = await this.getLogoFromStorage(companyId);
    if (existingLogo?.filePath && fs.existsSync(existingLogo.filePath)) {
      try {
        fs.unlinkSync(existingLogo.filePath);
      } catch (error: any) {
        console.warn('⚠️ No se pudo borrar archivo anterior:', error.message);
      }
    }
    await this.deleteLogoFromStorage(companyId);
  }

  private async saveLogoFile(file: Express.Multer.File, fileBuffer: Buffer, companyId: string): Promise<string> {
    if (!file.path || !fs.existsSync(file.path)) {
      const filename = `${companyId}_${Date.now()}${path.extname(file.originalname)}`;
      const filePath = path.join(UPLOAD_DIR, filename);
      fs.writeFileSync(filePath, fileBuffer);
      return filePath;
    }
    return file.path;
  }

  private async saveLogoToStorage(companyId: string, file: any, base64: string): Promise<LogoData> {
    const logosDB = this.loadLogosDatabase();
    
    const logoData: LogoData = {
      companyId,
      filename: path.basename(file.path),
      originalName: file.originalname,
      mimeType: file.mimetype,
      filePath: file.path,
      fileUrl: `/uploads/logos/${path.basename(file.path)}`,
      base64,
      size: base64.length,
      originalSize: file.size,
      uploadedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      publicUrl: `http://localhost:3000/api/email/logo-image/${companyId}`,
    };
    
    logosDB[companyId] = logoData;
    this.saveLogosDatabase(logosDB);
    
    return logoData;
  }

  private loadLogosDatabase(): Record<string, LogoData> {
    if (!fs.existsSync(LOGOS_DB_PATH)) return {};
    const content = fs.readFileSync(LOGOS_DB_PATH, 'utf8');
    if (!content.trim()) return {};
    try {
      return JSON.parse(content);
    } catch (error: any) {
      console.warn('⚠️ Error parseando JSON de logos, creando nuevo:', error.message);
      return {};
    }
  }

  private saveLogosDatabase(logosDB: Record<string, LogoData>) {
    const dbDir = path.dirname(LOGOS_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(LOGOS_DB_PATH, JSON.stringify(logosDB, null, 2));
  }

  private async getLogoFromStorage(companyId: string): Promise<LogoData | null> {
    const logosDB = this.loadLogosDatabase();
    const logoData = logosDB[companyId];
    
    if (!logoData) return null;
    
    if (logoData.filePath && fs.existsSync(logoData.filePath)) {
      try {
        const fileStats = fs.statSync(logoData.filePath);
        if (fileStats.size === 0) {
          if (logoData.base64 && this.isValidBase64(logoData.base64)) return logoData;
          return null;
        }
        
        if (!logoData.base64 || !this.isValidBase64(logoData.base64)) {
          const fileBuffer = fs.readFileSync(logoData.filePath);
          logoData.base64 = `data:${logoData.mimeType || 'image/png'};base64,${fileBuffer.toString('base64')}`;
          logoData.size = logoData.base64.length;
          logoData.lastUpdated = new Date().toISOString();
          logosDB[companyId] = logoData;
          this.saveLogosDatabase(logosDB);
        }
        
        return logoData;
      } catch (error: any) {
        console.error('❌ Error accediendo al archivo físico:', error);
        return null;
      }
    }
    
    if (logoData.base64 && this.isValidBase64(logoData.base64)) return logoData;
    
    delete logosDB[companyId];
    this.saveLogosDatabase(logosDB);
    return null;
  }

  private async validateAndRegenerateLogo(logoData: LogoData): Promise<LogoData> {
    if (!logoData.base64 || !this.isValidBase64(logoData.base64)) {
      if (logoData.filePath && fs.existsSync(logoData.filePath)) {
        try {
          const fileBuffer = fs.readFileSync(logoData.filePath);
          logoData.base64 = `data:${logoData.mimeType};base64,${fileBuffer.toString('base64')}`;
          logoData.size = logoData.base64.length;
          logoData.lastUpdated = new Date().toISOString();
          await this.updateLogoInStorage(logoData.companyId, logoData);
        } catch (error: any) {
          console.error('❌ Error regenerando base64:', error);
        }
      }
    }
    return logoData;
  }

  private async updateLogoInStorage(companyId: string, updatedData: Partial<LogoData>) {
    const logosDB = this.loadLogosDatabase();
    if (logosDB[companyId]) {
      logosDB[companyId] = { ...logosDB[companyId], ...updatedData, lastUpdated: new Date().toISOString() };
      this.saveLogosDatabase(logosDB);
    }
  }

  private async deleteLogoFromStorage(companyId: string) {
    const logosDB = this.loadLogosDatabase();
    if (logosDB[companyId]) {
      delete logosDB[companyId];
      this.saveLogosDatabase(logosDB);
    }
  }

  private isValidBase64(base64: string): boolean {
    if (!base64) return false;
    const isDataUrl = base64.startsWith('data:image/') && base64.includes('base64,');
    const hasMinimumSize = base64.length > 100;
    const parts = base64.split(',');
    const hasValidStructure = parts.length === 2;
    return isDataUrl && hasMinimumSize && hasValidStructure;
  }

  // Métodos de email
  private maskGmailSender(body: TestEmailRequest): { fromEmail: string; fromName: string } {
    const defaultFromName = body.metadata?.companyName || 'OmniNotify System';
    const userEmail = body.smtpConfig?.auth?.user || '';
    
    if (userEmail.includes('@gmail.com') || !userEmail) {
      let domain = 'ominotify.com';
      if (body.metadata?.companyName) {
        const cleanName = body.metadata.companyName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .substring(0, 20);
        if (cleanName.length >= 3) domain = `${cleanName}.com`;
      }
      return { fromEmail: `no-reply@${domain}`, fromName: defaultFromName };
    }
    
    const emailDomain = userEmail.split('@')[1] || 'company.com';
    return { fromEmail: `no-reply@${emailDomain}`, fromName: defaultFromName };
  }

  private getMaskedConfig(companyName?: string): { fromEmail: string; fromName: string } {
    return this.maskGmailSender({
      provider: 'smtp',
      smtpConfig: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: 'hgerson3000@gmail.com', pass: 'hwovycjveukvzqwd' }
      },
      metadata: { companyName }
    } as TestEmailRequest);
  }

  private buildEmailConfig(body: TestEmailRequest, maskedConfig: { fromEmail: string; fromName: string }): EmailConfig {
    const config: EmailConfig = { provider: body.provider, apiKey: body.apiKey };
    if (body.smtpConfig) {
      config.smtp = {
        ...body.smtpConfig,
        fromEmail: maskedConfig.fromEmail,
        fromName: maskedConfig.fromName,
      };
    }
    return config;
  }

  private async sendEmailWithConfig(config: EmailConfig, payload: any, metadata?: any): Promise<any> {
    if (config.provider === 'sendgrid' && config.apiKey) {
      throw new BadRequestException('SendGrid no configurado para pruebas');
    } else if (config.smtp) {
      return this.sendViaSMTP(config.smtp, payload, metadata);
    }
    throw new BadRequestException('Configuración de email no válida');
  }

  private async sendViaSMTP(smtpConfig: any, payload: any, metadata?: any): Promise<any> {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth,
    });

    await transporter.verify();
    
    const mailOptions = {
      from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers: {
        'X-Company-Name': metadata?.companyName || 'OmniNotify',
        'X-Mailer': 'OmniNotify Email Service',
        'X-Company-ID': metadata?.companyId || 'unknown',
        'X-Test-Type': metadata?.testType || 'connection_test',
        'X-Logo-Included': metadata?.includeLogo ? 'yes' : 'no',
      },
    };

    return transporter.sendMail(mailOptions);
  }

  // Métodos de templates
  private generateTestEmailHTML(params: EmailContentParams): { html: string; text: string } {
    const companyName = params.companyName || 'Mi Empresa';
    const currentDate = new Date();
    const { logoHtml, useLogo } = this.generateLogoHTML(params);
    
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prueba de Email - ${companyName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; }
    .email-container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e8e8e8; }
    .email-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
    .email-body { padding: 40px; }
    .success-icon { text-align: center; font-size: 64px; color: #10b981; margin-bottom: 20px; }
    .test-details { background-color: #f8f9fa; border-radius: 10px; padding: 25px; margin: 25px 0; border-left: 5px solid #3b82f6; }
    .email-footer { background-color: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 14px; line-height: 1.5; }
    .button { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin-top: 25px; font-weight: 600; font-size: 16px; }
    .details-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .details-table td { padding: 10px 0; border-bottom: 1px solid #e9ecef; }
    .details-table td:first-child { font-weight: 600; color: #495057; }
    .details-table td:last-child { text-align: right; color: #6c757d; }
    .masked-info { background-color: #e8f4fd; border: 1px solid #b6d4fe; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center; }
    @media (max-width: 600px) { .email-body { padding: 25px; } .email-header { padding: 30px 15px; } }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">${logoHtml}
      <h1 style="margin: 10px 0 5px 0; font-size: 28px; font-weight: 700;">${companyName}</h1>
      <p style="margin: 0; opacity: 0.9; font-size: 16px;">Sistema de Notificaciones</p>
    </div>
    <div class="email-body">
      <div class="success-icon">✅</div>
      <h2 style="text-align: center; color: #333; margin-bottom: 20px; font-size: 24px;">¡Prueba de Email Exitosa!</h2>
      <p style="text-align: center; color: #555; margin-bottom: 25px; font-size: 16px;">
        Este email confirma que la configuración de notificaciones por email de <strong style="color: #3b82f6;">${companyName}</strong> está funcionando correctamente.
      </p>
      <div class="masked-info">
        <p style="margin: 0; color: #0c63e4; font-weight: 600;">📧 Email enviado desde sistema enmascarado</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: #0a58ca;">
          Cliente ve: ${companyName} &lt;no-reply@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15)}.com&gt;
        </p>
      </div>
      <div class="test-details">
        <h3 style="color: #3b82f6; margin-top: 0; margin-bottom: 15px; font-size: 18px;">📋 Detalles de la Prueba</h3>
        <table class="details-table">
          <tr><td>Fecha:</td><td>${currentDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
          <tr><td>Hora:</td><td>${currentDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td></tr>
          <tr><td>Estado:</td><td><span style="color: #10b981; font-weight: bold;">CONEXIÓN EXITOSA</span></td></tr>
          <tr><td>Incluye logo:</td><td>${useLogo ? '✅ Sí' : '❌ No'}</td></tr>
          <tr><td>Tipo de prueba:</td><td>${params.testType}</td></tr>
        </table>
      </div>
      <p style="color: #555; line-height: 1.7; font-size: 15px;">
        Si recibiste este email, significa que tu configuración de notificaciones por email está funcionando correctamente.
      </p>
      <div style="text-align: center; margin-top: 30px;"><a href="#" class="button">Ir al Panel de Control</a></div>
    </div>
    <div class="email-footer">
      <p style="margin: 0 0 10px 0; font-size: 13px;">© ${currentDate.getFullYear()} ${companyName}. Todos los derechos reservados.</p>
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #868e96;">Este es un email de prueba generado automáticamente. No respondas a este mensaje.</p>
      <p style="margin: 0; font-size: 11px; color: #adb5bd;">Enviado desde OmniNotify • Sistema de Notificaciones Profesionales • v2.0</p>
    </div>
  </div>
</body>
</html>`;

    const text = `
PRUEBA DE EMAIL - ${companyName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
¡PRUEBA DE EMAIL EXITOSA!
Este email confirma que la configuración de notificaciones por email de ${companyName} está funcionando correctamente.
📋 DETALLES DE LA PRUEBA
────────────────────────
• Fecha: ${currentDate.toLocaleDateString()}
• Hora: ${currentDate.toLocaleTimeString()}
• Estado: CONEXIÓN EXITOSA
• Incluye logo: ${useLogo ? 'Sí' : 'No'}
• Tipo: ${params.testType}
ℹ️ INFORMACIÓN
──────────────
Este email fue enviado desde un sistema con remitente enmascarado.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
© ${currentDate.getFullYear()} ${companyName}
Este es un email de prueba generado automáticamente por OmniNotify v2.0.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return { html, text };
  }

  private generateLogoHTML(params: EmailContentParams): { logoHtml: string; useLogo: boolean } {
    let logoHtml = '';
    let useLogo = false;
    
    if (params.includeLogo && typeof params.companyId === 'string') {
      useLogo = true;

      const publicLogoUrl =
        `http://localhost:3000/api/email/logo-image/${params.companyId}`;

      const base64Fallback = params.companyLogo && this.isValidBase64(params.companyLogo) ? params.companyLogo : '';
      
      logoHtml = `
        <div style="text-align: center; margin: 0 auto 25px auto; max-width: 200px;">
          <img src="${publicLogoUrl}" 
               ${base64Fallback ? `data-fallback="${base64Fallback}"` : ''}
               alt="${params.companyName || 'Logo'}" 
               style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e0e0e0; background: white; padding: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
               width="200" height="auto"
               onerror="if (this.getAttribute('data-fallback')) { this.src = this.getAttribute('data-fallback'); }">
          <p style="font-size: 11px; color: #666; margin-top: 5px; font-style: italic;">
            Logo de ${params.companyName || 'Empresa'}
          </p>
        </div>`;
    } else {
      logoHtml = `
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
               color: white; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            ${params.companyName?.substring(0, 15) || 'Empresa'}
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 10px;">Sistema de Notificaciones</p>
        </div>`;
    }
    
    return { logoHtml, useLogo };
  }

  private async getLogoForCompany(companyId?: string): Promise<string | null> {
    if (!companyId) return null;
    const logoFromBackend = await this.getLogoFromStorage(companyId);
    return logoFromBackend?.base64 && this.isValidBase64(logoFromBackend.base64) ? logoFromBackend.base64 : null;
  }

  private generateNotificationContent(body: any): { htmlContent: string; textContent: string } {
    const templates = {
      'welcome-email': this.generateWelcomeEmail(body),
      'notification-alert': this.generateAlertEmail(body),
      'promotional-email': this.generatePromotionalEmail(body),
      default: this.generateDefaultEmail(body),
    };
    
    return templates[body.templateId as keyof typeof templates] || templates.default;
  }

  private generateWelcomeEmail(body: any) {
    const companyName = body.variables?.companyName || 'Nuestra Empresa';
    const userName = body.variables?.userName || 'Estimado usuario';
    
    return {
      htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>¡Bienvenido a ${companyName}!</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>¡Bienvenido a ${companyName}!</h1>
            <p>Estamos emocionados de tenerte con nosotros</p>
        </div>
        <div class="content">
            <h2>Hola ${userName},</h2>
            <p>Te damos la más cordial bienvenida a nuestra plataforma.</p>
            
            <p>Con tu cuenta puedes:</p>
            <ul>
                <li>Acceder a todas las funciones de la plataforma</li>
                <li>Recibir notificaciones importantes</li>
                <li>Configurar tus preferencias</li>
                <li>Contactar con soporte las 24/7</li>
            </ul>
            
            <div style="text-align: center;">
                <a href="#" class="button">Comenzar a Explorar</a>
            </div>
            
            <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
            <p>Saludos cordiales,<br>El equipo de ${companyName}</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} ${companyName}. Todos los derechos reservados.</p>
            <p>Este es un email automático, por favor no responder.</p>
        </div>
    </div>
</body>
</html>`,
      textContent: `¡BIENVENIDO A ${companyName}!

Hola ${userName},

Te damos la más cordial bienvenida a nuestra plataforma.

Con tu cuenta puedes:
- Acceder a todas las funciones de la plataforma
- Recibir notificaciones importantes
- Configurar tus preferencias
- Contactar con soporte las 24/7

Para comenzar a explorar, visita nuestra plataforma.

Si tienes alguna pregunta, no dudes en contactarnos.

Saludos cordiales,
El equipo de ${companyName}

© ${new Date().getFullYear()} ${companyName}
Este es un email automático, por favor no responder.`
    };
  }

  private generateAlertEmail(body: any) {
    const companyName = body.variables?.companyName || 'Sistema';
    const title = body.variables?.notificationTitle || 'Notificación Importante';
    const message = body.variables?.notificationMessage || 'Este es un mensaje de notificación del sistema que requiere tu atención.';
    
    return {
      htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Nueva Notificación - ${companyName}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px 20px; text-align: center; }
        .alert-icon { font-size: 48px; margin-bottom: 15px; }
        .content { padding: 30px; }
        .alert-box { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="alert-icon">⚠️</div>
            <h1>Nueva Notificación</h1>
            <p>${companyName} - Sistema de Alertas</p>
        </div>
        <div class="content">
            <div class="alert-box">
                <h2 style="margin-top: 0; color: #d97706;">${title}</h2>
                <p>${message}</p>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
                <strong>Importante:</strong> Esta es una notificación automática del sistema. 
                Si crees que recibiste este mensaje por error, por favor ignóralo.
            </p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} ${companyName}. Todos los derechos reservados.</p>
            <p>Sistema de Notificaciones Automáticas • Seguridad Nivel Alto</p>
        </div>
    </div>
</body>
</html>`,
      textContent: `NUEVA NOTIFICACIÓN - ${companyName}

⚠️ ALERTA DEL SISTEMA ⚠️

Título: ${title}
Mensaje: ${message}

IMPORTANTE: Esta es una notificación automática del sistema.
Si crees que recibiste este mensaje por error, por favor ignóralo.

© ${new Date().getFullYear()} ${companyName}
Sistema de Notificaciones Automáticas • Seguridad Nivel Alto`
    };
  }

  private generatePromotionalEmail(body: any) {
    const companyName = body.variables?.companyName || 'Nuestra Empresa';
    const offerTitle = body.variables?.offerTitle || '¡Oferta Especial!';
    const offerDescription = body.variables?.offerDescription || 'Aprovecha esta oferta exclusiva por tiempo limitado';
    const discountCode = body.variables?.discountCode || 'DESCUENTO10';
    const expiryDate = body.variables?.expiryDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES');
    
    return {
      htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>¡Oferta Especial! - ${companyName}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 40px 20px; text-align: center; }
        .offer-badge { background: #ff6b6b; color: white; padding: 10px 20px; border-radius: 20px; display: inline-block; font-weight: bold; margin: 10px 0; }
        .content { padding: 30px; }
        .discount-box { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 15px 40px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-size: 18px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 32px;">🎉 ¡OFERTA ESPECIAL!</h1>
            <p style="font-size: 18px; opacity: 0.9;">Exclusiva para nuestros valiosos clientes</p>
            <div class="offer-badge">LIMITADA • POR TIEMPO</div>
        </div>
        <div class="content">
            <h2 style="color: #3b82f6; text-align: center;">${offerTitle}</h2>
            <p style="text-align: center; font-size: 18px;">${offerDescription}</p>
            
            <div class="discount-box">
                <h3 style="margin: 0; font-size: 24px;">TU CÓDIGO DE DESCUENTO</h3>
                <div style="background: white; color: #f5576c; padding: 15px; border-radius: 8px; margin: 15px 0; font-family: monospace; font-size: 28px; font-weight: bold;">
                    ${discountCode}
                </div>
                <p>Válido hasta: <strong>${expiryDate}</strong></p>
            </div>
            
            <div style="text-align: center;">
                <a href="#" class="button">🔥 Aprovechar Oferta Ahora 🔥</a>
            </div>
            
            <div style="margin-top: 30px; padding: 15px; background: #fef3c7; border-radius: 8px; border: 1px solid #f59e0b;">
                <p style="margin: 0; color: #92400e; text-align: center;">
                    ⚠️ <strong>Esta oferta expira el ${expiryDate}</strong> ⚠️<br>
                    No pierdas esta oportunidad única
                </p>
            </div>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} ${companyName}. Todos los derechos reservados.</p>
            <p>Promoción válida hasta ${expiryDate} • No acumulable con otras promociones</p>
        </div>
    </div>
</body>
</html>`,
      textContent: `🎉 ¡OFERTA ESPECIAL DE ${companyName}! 🎉

${offerTitle}

${offerDescription}

🔥 TU CÓDIGO DE DESCUENTO 🔥
${discountCode}

Válido hasta: ${expiryDate}

⚠️ Esta oferta expira el ${expiryDate} ⚠️
No pierdas esta oportunidad única

© ${new Date().getFullYear()} ${companyName}
Promoción válida hasta ${expiryDate} • No acumulable con otras promociones`
    };
  }

  private generateDefaultEmail(body: any) {
    return {
      htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${body.subject}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${body.subject}</h1>
        </div>
        <div class="content">
            <h2>Notificación Importante</h2>
            <p>Este es un mensaje de notificación enviado desde OmniNotify v2.0.</p>
            <p>Fecha: ${new Date().toLocaleDateString('es-ES')}</p>
            <p>Hora: ${new Date().toLocaleTimeString('es-ES')}</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} OmniNotify. Todos los derechos reservados.</p>
            <p>Email enviado desde sistema de notificaciones con BullMQ</p>
        </div>
    </div>
</body>
</html>`,
      textContent: `${body.subject}

Notificación Importante

Este es un mensaje de notificación enviado desde OmniNotify v2.0.

Fecha: ${new Date().toLocaleDateString('es-ES')}
Hora: ${new Date().toLocaleTimeString('es-ES')}

© ${new Date().getFullYear()} OmniNotify
Email enviado desde sistema de notificaciones con BullMQ`
    };
  }

  // Métodos de respuesta
  private buildSuccessResponse(result: any, body: TestEmailRequest, maskedConfig: any, 
                              emailParams: EmailContentParams, logoSource: string, logoSizeKB: number) {
    return {
      success: true,
      message: 'Email de prueba enviado exitosamente',
      result: {
        provider: body.provider,
        messageId: result.messageId || `test_${Date.now()}`,
        recipient: body.to,
        sender: maskedConfig.fromEmail,
        senderName: maskedConfig.fromName,
        includesLogo: !!emailParams.companyLogo,
        companyName: emailParams.companyName,
        maskedFormat: `${maskedConfig.fromName} <${maskedConfig.fromEmail}>`,
        logoSource,
        logoOptimized: emailParams.companyLogo ? 'logo_incluido' : 'sin_logo',
        logoSizeKB,
      },
    };
  }

  private buildErrorResponse(error: any, message: string) {
    console.error('='.repeat(50));
    console.error('❌ ERROR:', message);
    console.error('Mensaje:', error.message);
    console.error('Stack:', error.stack?.split('\n')[0]);
    console.error('='.repeat(50));
    
    const errorMessage = error.message.includes('PayloadTooLargeError') 
      ? 'El archivo es demasiado grande. Por favor, comprime la imagen o usa una de menor tamaño.' 
      : error.message;
    
    return {
      success: false,
      message,
      error: errorMessage,
    };
  }

  private buildLogoResponse(logoData: LogoData, found: boolean) {
    return {
      success: true,
      data: {
        companyId: logoData.companyId,
        filename: found ? logoData.filename : null,
        fileUrl: found ? logoData.fileUrl : null,
        base64: found && logoData.base64 && this.isValidBase64(logoData.base64) ? logoData.base64 : null,
        hasLogo: found && !!logoData.base64 && this.isValidBase64(logoData.base64),
        size: found ? logoData.size || 0 : 0,
        uploadedAt: found ? logoData.uploadedAt : null,
        message: found ? 'Logo encontrado en almacenamiento del backend' : 'No se encontró logo para esta empresa',
        publicUrl: `http://localhost:3000/api/email/logo-image/${logoData.companyId}`,
      },
    };
  }

  private buildUploadSuccessResponse(logoData: LogoData, fileBuffer: Buffer, base64: string) {
    return {
      success: true,
      message: 'Logo subido exitosamente',
      data: {
        filename: logoData.filename,
        fileUrl: logoData.fileUrl,
        base64,
        companyId: logoData.companyId,
        size: fileBuffer.length,
        base64Size: base64.length,
        originalSize: logoData.originalSize,
        uploadedAt: new Date().toISOString(),
        isOptimized: false,
        hasLogo: true,
        publicUrl: logoData.publicUrl,
      },
    };
  }

  private getContentTypeFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.svg') return 'image/svg+xml';
    return 'image/png';
  }

  private setImageHeaders(res: Response, contentType: string) {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  private generatePlaceholderSVG(companyId: string): string {
    const colorIndex = companyId.length % LOGO_COLORS.length;
    const color = LOGO_COLORS[colorIndex];
    const initials = companyId.substring(0, 2).toUpperCase();
    
    return `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="grad${colorIndex}" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:${color};stop-opacity:0.8" />
    <stop offset="100%" style="stop-color:${color.replace(')', ', 0.6)')};stop-opacity:0.4" />
  </linearGradient></defs>
  <rect width="200" height="200" rx="20" fill="url(#grad${colorIndex})" />
  <circle cx="100" cy="80" r="40" fill="white" opacity="0.9" />
  <text x="100" y="85" font-family="Arial, sans-serif" font-size="32" fill="${color}" text-anchor="middle" font-weight="bold" dy="0.3em">${initials}</text>
  <text x="100" y="140" font-family="Arial, sans-serif" font-size="14" fill="white" text-anchor="middle" font-weight="bold">${companyId.substring(0, 12)}${companyId.length > 12 ? '...' : ''}</text>
  <text x="100" y="165" font-family="Arial, sans-serif" font-size="10" fill="rgba(255,255,255,0.7)" text-anchor="middle">Upload logo en panel</text>
</svg>`;
  }

  private generateErrorSVG(): string {
    return `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" rx="20" fill="#f8f9fa" />
  <circle cx="100" cy="80" r="40" fill="#e9ecef" />
  <text x="100" y="85" font-family="Arial, sans-serif" font-size="32" fill="#6c757d" text-anchor="middle" font-weight="bold" dy="0.3em">❌</text>
  <text x="100" y="140" font-family="Arial, sans-serif" font-size="12" fill="#495057" text-anchor="middle" font-weight="bold">Error cargando logo</text>
  <text x="100" y="165" font-family="Arial, sans-serif" font-size="10" fill="#868e96" text-anchor="middle">Intenta subir de nuevo</text>
</svg>`;
  }

  private logSection(title: string) {
    console.log('='.repeat(50));
    console.log(title);
    console.log('='.repeat(50));
  }

  private logEmailDetails(body: TestEmailRequest, maskedConfig: any, logoSource: string, logoSizeKB: number) {
    console.log('📧 Destinatario:', body.to);
    console.log('🏢 Empresa:', body.metadata?.companyName || 'OmniNotify');
    console.log('🔄 Proveedor:', body.provider);
    console.log('🎭 Remitente enmascarado:', maskedConfig);
    console.log(`📤 Email desde: ${maskedConfig.fromName} <${maskedConfig.fromEmail}>`);
    console.log('🎨 Logo source:', logoSource);
    console.log('📏 Logo size:', logoSizeKB ? logoSizeKB + 'KB' : 'No hay logo');
    console.log('🚀 Enviando email...');
  }
}