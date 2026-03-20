import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { NotificationsService } from '../notifications.service';
import { SMSProvider, SMSConfig, SMSContent } from '../providers/sms/sms.provider';
import { SendNotificationDto, NotificationChannel } from '../dto/send-notification.dto';
import { SendSmsDto, TestSmsDto } from '../dto/send-sms.dto';
import { SystemConfigService } from '../../system/services/system-config.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

interface TestSmsRequest {
  to: string;
  text?: string;
  provider: 'vonage' | 'twilio';
  apiKey?: string;
  apiSecret?: string;
  fromNumber?: string;
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

interface TwilioBalanceResponse {
  balance: string;
  currency: string;
}

@Controller('sms')
@UseGuards(JwtAuthGuard)
export class SmsController {
  private readonly logger = new Logger(SmsController.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly smsProvider: SMSProvider,
    private readonly systemConfigService: SystemConfigService,
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {
    this.logger.log('✅ SmsController inicializado con SystemConfigService');
  }

  // ==================== ENDPOINTS PÚBLICOS ====================

  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendSms(@Body() dto: SendNotificationDto) {
    dto.channel = NotificationChannel.SMS;

    const job = await this.notificationsQueue.add('send-notification', dto, {
      attempts: parseInt(process.env.QUEUE_ATTEMPTS || '3'),
      backoff: {
        type: 'exponential',
        delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '2000'),
      },
    });

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
  async sendDirectSms(
    @Body()
    body: {
      to: string;
      text: string;
      companyId: string;
      provider: 'vonage' | 'twilio';
      config?: {
        apiKey?: string;
        apiSecret?: string;
        fromNumber?: string;
        accountSid?: string;
        authToken?: string;
      };
      schedule?: string;
      variables?: Record<string, string>;
    },
  ) {
    try {
      this.logger.log('📱 ENVIANDO SMS DIRECTAMENTE');

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
        ...(body.config || {}),
      };

      const smsPayload: SMSContent = {
        to: body.to,
        text: body.text,
        from: body.config?.fromNumber,
      };

      let result;

      if (scheduledDate) {
        const delay = scheduledDate.getTime() - Date.now();

        const dto: SendNotificationDto = {
          recipient: body.to,
          channel: NotificationChannel.SMS,
          companyId: body.companyId,
          variables: { text: body.text, ...body.variables },
          templateId: 'direct-sms',
          content: body.text,
          scheduling: {
            is_scheduled: true,
            send_at: body.schedule,
          },
        };

        const job = await this.notificationsQueue.add('send-notification', dto, {
          delay: delay > 0 ? delay : 0,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          jobId: `sms_sch_${Date.now()}`,
        });

        result = {
          scheduled: true,
          jobId: job.id,
          scheduledAt: scheduledDate,
        };
      } else {
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
  async testSms(@Body() body: TestSmsDto) {
    try {
      this.logger.log('📱 TEST DE SMS CON CREDENCIALES GLOBALES');
      
      this.validateTestRequest(body);

      this.logger.log('📱 Detalles del test:', {
        to: body.to,
        provider: body.provider,
        companyName: body.metadata?.companyName || 'OmniNotify',
      });

      let smsConfig: SMSConfig = {
        provider: body.provider,
      };

      if (body.provider === 'vonage') {
        if (body.apiKey || body.apiSecret) {
          smsConfig.apiKey = body.apiKey;
          smsConfig.apiSecret = body.apiSecret;
          smsConfig.fromNumber = body.fromNumber;
          this.logger.log('📦 Usando credenciales proporcionadas para Vonage');
        } else {
          this.logger.log('📦 Se usarán credenciales globales de Vonage desde BD');
        }
      } else if (body.provider === 'twilio') {
        if (body.accountSid || body.authToken) {
          smsConfig.accountSid = body.accountSid;
          smsConfig.authToken = body.authToken;
          smsConfig.fromNumber = body.fromNumber;
          this.logger.log('📦 Usando credenciales proporcionadas para Twilio');
        } else {
          this.logger.log('📦 Se usarán credenciales globales de Twilio desde BD');
        }
      }

      const companyName = body.metadata?.companyName || 'OmniNotify';
      const testType = body.metadata?.testType || 'connection_test';
      const testMessage = this.generateTestMessage(companyName, testType);

      const smsPayload: SMSContent = {
        to: body.to,
        text: testMessage,
        from: body.fromNumber,
      };

      const result = await this.smsProvider.send(smsConfig, smsPayload);

      const source = (body.provider === 'vonage' && (body.apiKey || body.apiSecret)) ||
                     (body.provider === 'twilio' && (body.accountSid || body.authToken))
                     ? 'provided' : 'database';

      const responseResult: any = {
        provider: body.provider,
        messageId: result.messageId,
        recipient: body.to,
        companyName,
        status: result.status || 'sent',
        source,
      };

      if (result.remainingBalance !== undefined) {
        responseResult.remainingBalance = result.remainingBalance;
        responseResult.messagePrice = result.messagePrice;
        responseResult.network = result.network;
      }

      if (result.price !== undefined) {
        responseResult.price = result.price;
        responseResult.priceUnit = result.priceUnit;
        responseResult.dateCreated = result.dateCreated;
      }

      return {
        success: true,
        message: 'SMS de prueba enviado exitosamente',
        result: responseResult,
      };
    } catch (error: any) {
      this.logger.error(`Error enviando SMS de prueba: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private formatBalance(balance: number, currency: string = 'EUR'): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(balance);
  }

  @Get('balance/:companyId')
  @HttpCode(HttpStatus.OK)
  async getBalance(
    @Param('companyId') companyId: string,
    @Query('provider') provider: 'vonage' | 'twilio' = 'vonage',
  ) {
    try {
      this.logger.log(`💰 Obteniendo balance para ${companyId} con provider ${provider}`);

      if (provider === 'vonage') {
        const credentials = await this.systemConfigService.getVonageCredentials();
        
        const config: SMSConfig = {
          provider: 'vonage',
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret,
        };

        const balance = await this.smsProvider.getBalance(config);
        const formattedBalance = this.formatBalance(balance, 'EUR');

        return {
          success: true,
          companyId,
          provider,
          balance: {
            value: balance,
            currency: 'EUR',
            formatted: formattedBalance,
          },
          timestamp: new Date().toISOString(),
          source: 'database',
        };
      } 
      else if (provider === 'twilio') {
        const credentials = await this.systemConfigService.getTwilioCredentials();
        const balance = await this.getTwilioBalanceFromAPI(credentials);
        const formattedBalance = this.formatBalance(
          parseFloat(balance.balance), 
          balance.currency
        );

        return {
          success: true,
          companyId,
          provider,
          balance: {
            value: parseFloat(balance.balance),
            currency: balance.currency,
            formatted: formattedBalance,
          },
          timestamp: new Date().toISOString(),
          source: 'database',
        };
      }
    } catch (error: any) {
      this.logger.error(`Error obteniendo balance: ${error.message}`);
      return {
        success: false,
        error: error.message,
        source: 'database',
      };
    }
  }

  @Get('twilio/balance')
  @HttpCode(HttpStatus.OK)
  async getTwilioBalanceEndpoint() {
    try {
      this.logger.log('💰 Obteniendo balance de Twilio');
      
      const credentials = await this.systemConfigService.getTwilioCredentials();
      const balance = await this.getTwilioBalanceFromAPI(credentials);
      
      return {
        success: true,
        balance: {
          balance: balance.balance,
          currency: balance.currency
        }
      };
    } catch (error: any) {
      this.logger.error(`Error obteniendo balance de Twilio: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async getTwilioBalanceFromAPI(credentials: { accountSid: string; authToken: string }): Promise<TwilioBalanceResponse> {
    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Balance.json`,
        {
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString('base64'),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Twilio API error: ${response.statusText}`);
      }

      const data = await response.json() as TwilioBalanceResponse;
      return data;
    } catch (error: any) {
      this.logger.error(`Error en API de Twilio: ${error.message}`);
      throw error;
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

  @Post('webhook/twilio')
  @HttpCode(HttpStatus.OK)
  async handleTwilioWebhook(@Body() body: any) {
    try {
      this.logger.log('🔄 Webhook de Twilio recibido:', {
        messageSid: body.MessageSid,
        messageStatus: body.MessageStatus,
        to: body.To,
        from: body.From,
      });

      return {
        success: true,
        message: 'Webhook de Twilio procesado',
        data: body,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error('Error procesando webhook de Twilio:', error);
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
        'twilio-integration',
        'balance-check-vonage',
        'balance-check-twilio',
        'webhook-support',
        'scheduled-sms',
        'bullmq-queue',
        'global-credentials',
      ],
      version: '2.0.0',
      providers: ['vonage', 'twilio'],
      limits: {
        messageLength: '1600 caracteres',
        scheduleDays: '30 días máximo',
        queueJobs: '1000 concurrentes',
      },
      webhooks: {
        vonage: '/api/sms/webhook/vonage',
        twilio: '/api/sms/webhook/twilio',
      },
    };
  }

  // ==================== MÉTODOS AUXILIARES PRIVADOS ====================

  private validateTestRequest(body: TestSmsDto) {
    if (!body) throw new BadRequestException('El cuerpo de la solicitud está vacío');
    if (!body.to) throw new BadRequestException('El campo "to" es requerido');
    if (!body.provider) throw new BadRequestException('El campo "provider" es requerido');
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

  private buildErrorResponse(error: any, message: string) {
    this.logger.error('='.repeat(50));
    this.logger.error('❌ ERROR SMS:', message);
    this.logger.error('Mensaje:', error.message);
    this.logger.error('Stack:', error.stack?.split('\n')[0]);
    this.logger.error('='.repeat(50));

    return {
      success: false,
      message,
      error: error.message,
    };
  }
}