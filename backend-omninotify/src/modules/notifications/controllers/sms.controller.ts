  import { 
    Controller, 
    Post, 
    Body, 
    Get, 
    Param, 
    Query,
    HttpCode,
    HttpStatus,
    Logger,
    BadRequestException 
  } from '@nestjs/common';
  import { InjectQueue } from '@nestjs/bullmq';
  import { Queue } from 'bullmq';

  import { NotificationsService } from '../notifications.service';
  import { SMSProvider, SMSConfig, SMSContent } from '../providers/sms/sms.provider';
  import { SendNotificationDto, NotificationChannel } from '../dto/send-notification.dto';
  import { SendSmsDto, TestSmsDto } from '../dto/send-sms.dto';

  interface TestSmsRequest {
    to: string;
    text: string;
    provider: 'vonage' | 'twilio';
    apiKey?: string;
    apiSecret?: string;
    fromNumber?: string;
    // Para Twilio
    accountSid?: string;
    authToken?: string;
    metadata?: {
      companyName?: string;
      companyId?: string;
      testType?: string;
    };
  }

  interface SmsWebhookDto {
    messageId: string;
    msisdn: string;
    to: string;
    messageTimestamp: string;
    text: string;
    type: string;
    keyword: string;
    ['message-timestamp']?: string;
    ['err-code']?: string;
  }

  @Controller('sms')
  export class SmsController {
    private readonly logger = new Logger(SmsController.name);

    constructor(
      private readonly notificationsService: NotificationsService,
      private readonly smsProvider: SMSProvider,
      @InjectQueue('notifications') private notificationsQueue: Queue,
    ) {
      this.logger.log('✅ SmsController inicializado');
    }

    // ==================== ENDPOINTS PÚBLICOS ====================

    @Post('send')
    @HttpCode(HttpStatus.ACCEPTED)
    async sendSms(@Body() dto: SendNotificationDto) {
      dto.channel = NotificationChannel.SMS;
      
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
        message: 'SMS encolado para procesamiento',
        jobId: job.id,
        timestamp: new Date().toISOString(),
        status: 'queued',
        checkStatus: `/api/sms/queue/job/${job.id}`,
      };
    }

    @Post('send-direct')
    @HttpCode(HttpStatus.OK)
    async sendDirectSms(@Body() body: {
      to: string;
      text: string;
      companyId: string;
      provider: 'vonage' | 'twilio';
      config: {
        apiKey?: string;
        apiSecret?: string;
        fromNumber?: string;
        accountSid?: string;
        authToken?: string;
      };
      schedule?: string;
      variables?: Record<string, string>;
    }) {
      try {
        this.logger.log('📱 ENVIANDO SMS DIRECTAMENTE');
        
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

        const smsConfig: SMSConfig = {
          provider: body.provider,
          apiKey: body.config.apiKey,
          apiSecret: body.config.apiSecret,
          fromNumber: body.config.fromNumber,
          accountSid: body.config.accountSid,
          authToken: body.config.authToken,
        };

        const smsPayload: SMSContent = {
          to: body.to,
          text: body.text,
          from: body.config.fromNumber,
        };

        let result;
        
        if (scheduledDate) {
          // Programar el envío
          const delay = scheduledDate.getTime() - Date.now();
          
          const dto: SendNotificationDto = {
            recipient: body.to,
            channel: NotificationChannel.SMS,
            companyId: body.companyId,
            variables: body.variables,
            scheduledAt: body.schedule,
            templateId: 'direct-sms',
          };

          const job = await this.notificationsQueue.add(
            'send-notification',
            dto,
            {
              delay: delay > 0 ? delay : 0,
              attempts: 3,
              backoff: { type: 'exponential', delay: 1000 },
              jobId: `sms_sch_${Date.now()}`,
            }
          );

          result = {
            scheduled: true,
            jobId: job.id,
            scheduledAt: scheduledDate,
          };
        } else {
          // Envío inmediato
          result = await this.smsProvider.send(smsConfig, smsPayload);
        }

        return {
          success: true,
          message: scheduledDate ? 'SMS programado exitosamente' : 'SMS enviado exitosamente',
          data: result,
        };
      } catch (error: any) {
        return this.buildErrorResponse(error, 'Error enviando SMS');
      }
    }

    @Post('test')
    @HttpCode(HttpStatus.OK)
    async testSms(@Body() body: TestSmsRequest) {
      this.logSection('📱 TEST DE SMS');
      
      this.validateTestRequest(body);
      
      this.logger.log('📱 Detalles del test:', {
        to: body.to,
        provider: body.provider,
        companyName: body.metadata?.companyName || 'OmniNotify',
      });

      const smsConfig: SMSConfig = {
        provider: body.provider,
        apiKey: body.apiKey,
        apiSecret: body.apiSecret,
        fromNumber: body.fromNumber,
        accountSid: body.accountSid,
        authToken: body.authToken,
      };

      const companyName = body.metadata?.companyName || 'OmniNotify';
      const testType = body.metadata?.testType || 'connection_test';
      
      const testMessage = this.generateTestMessage(companyName, testType);
      
      const smsPayload: SMSContent = {
        to: body.to,
        text: body.text || testMessage,
        from: body.fromNumber,
      };

      try {
        const result = await this.smsProvider.send(smsConfig, smsPayload);
        return this.buildSuccessResponse(result, body, companyName);
      } catch (error: any) {
        return this.buildErrorResponse(error, 'Error enviando SMS de prueba');
      }
    }

    @Get('balance/:companyId')
    @HttpCode(HttpStatus.OK)
    async getBalance(
      @Param('companyId') companyId: string,
      @Query('provider') provider: 'vonage' | 'twilio'
    ) {
      try {
        this.logger.log(`💰 Obteniendo balance para ${companyId}`);
        
        // En una implementación real, obtendrías la configuración de la BD
        // Por ahora simulamos con variables de entorno o datos mock
        const config: SMSConfig = {
          provider: provider,
          apiKey: process.env.VONAGE_API_KEY, // Obtener de BD
          apiSecret: process.env.VONAGE_API_SECRET, // Obtener de BD
        };

        if (provider === 'vonage') {
          const balance = await this.smsProvider.getBalance(config);
          return {
            success: true,
            companyId,
            provider,
            balance: {
              value: balance,
              currency: 'EUR',
              formatted: `${balance.toFixed(2)} EUR`,
            },
            timestamp: new Date().toISOString(),
          };
        } else {
          return {
            success: false,
            message: 'Balance check solo disponible para Vonage actualmente',
          };
        }
      } catch (error: any) {
        return this.buildErrorResponse(error, 'Error obteniendo balance');
      }
    }

    @Post('webhook/vonage')
    @HttpCode(HttpStatus.OK)
    async handleVonageWebhook(@Body() body: SmsWebhookDto) {
      try {
        this.logger.log('🔄 Webhook de Vonage recibido:', {
          messageId: body.messageId,
          to: body.to,
          type: body.type,
          status: body['err-code'] ? 'failed' : 'delivered',
        });

        // Procesar el webhook (actualizar estado en BD, notificar, etc.)
        // Aquí puedes guardar el delivery report en tu base de datos

        return {
          success: true,
          message: 'Webhook procesado',
          data: body,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        this.logger.error('Error procesando webhook:', error);
        return {
          success: false,
          error: error.message,
        };
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

    @Get('health')
    @HttpCode(HttpStatus.OK)
    healthCheck() {
      return {
        status: 'healthy',
        service: 'sms',
        timestamp: new Date().toISOString(),
        features: [
          'test-sms', 
          'send-direct', 
          'queue-support',
          'vonage-integration',
          'balance-check',
          'webhook-support',
          'scheduled-sms',
          'bullmq-queue',
        ],
        version: '1.0.0',
        providers: ['vonage', 'twilio'],
        limits: {
          messageLength: '1600 caracteres',
          scheduleDays: '30 días máximo',
          queueJobs: '1000 concurrentes',
        },
        webhooks: {
          vonage: '/api/sms/webhook/vonage',
        },
      };
    }

    // ==================== MÉTODOS AUXILIARES PRIVADOS ====================

    private validateTestRequest(body: TestSmsRequest) {
      if (!body) throw new BadRequestException('El cuerpo de la solicitud está vacío');
      if (!body.to) throw new BadRequestException('El campo "to" es requerido');
      if (!body.provider) throw new BadRequestException('El campo "provider" es requerido');
      
      if (body.provider === 'vonage') {
        if (!body.apiKey) throw new BadRequestException('API Key de Vonage requerida');
        if (!body.apiSecret) throw new BadRequestException('API Secret de Vonage requerida');
      } else if (body.provider === 'twilio') {
        if (!body.accountSid) throw new BadRequestException('Account SID de Twilio requerida');
        if (!body.authToken) throw new BadRequestException('Auth Token de Twilio requerida');
      }
    }

    private generateTestMessage(companyName: string, testType: string): string {
      const timestamp = new Date().toLocaleString('es-ES');
      
      if (testType === 'connection_test') {
        return `✅ Prueba de SMS - ${companyName}\n\nHora: ${timestamp}\nEstado: CONEXIÓN EXITOSA\n\nEste SMS confirma que la configuración de notificaciones por SMS de ${companyName} está funcionando correctamente.`;
      } else if (testType === 'alert_test') {
        return `⚠️ ALERTA DE PRUEBA - ${companyName}\n\nHora: ${timestamp}\n\nEste es un mensaje de prueba del sistema de alertas. Si recibes este mensaje, el sistema está funcionando correctamente.`;
      } else {
        return `📱 SMS de prueba - ${companyName}\n\nHora: ${timestamp}\n\nEste es un mensaje de prueba enviado desde OmniNotify v2.0.`;
      }
    }

    private buildSuccessResponse(result: any, body: TestSmsRequest, companyName: string) {
      return {
        success: true,
        message: 'SMS de prueba enviado exitosamente',
        result: {
          provider: body.provider,
          messageId: result.messageId || `test_${Date.now()}`,
          recipient: body.to,
          companyName,
          remainingBalance: result.remainingBalance,
          messagePrice: result.messagePrice,
          network: result.network,
          status: 'sent',
        },
      };
    }

    private buildErrorResponse(error: any, message: string) {
      console.error('='.repeat(50));
      console.error('❌ ERROR SMS:', message);
      console.error('Mensaje:', error.message);
      console.error('Stack:', error.stack?.split('\n')[0]);
      console.error('='.repeat(50));
      
      return {
        success: false,
        message,
        error: error.message,
      };
    }

    private logSection(title: string) {
      console.log('='.repeat(50));
      console.log(title);
      console.log('='.repeat(50));
    }
  }