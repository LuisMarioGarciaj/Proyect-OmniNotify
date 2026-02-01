import { 
  IsEnum, 
  IsString, 
  IsObject, 
  IsOptional, 
  IsUUID, 
  IsNotEmpty, 
  IsDateString,
  IsEmail,
  IsBoolean,
  IsUrl
} from 'class-validator';
import { Type } from 'class-transformer';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP', // ← NUEVO
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  DELIVERED = 'DELIVERED',
  READ = 'READ', // Para WhatsApp
}

/**
 * DTO Principal para enviar notificaciones
 * Soporta múltiples canales: Email, SMS, WhatsApp
 */
export class SendNotificationDto {
  // ========== CAMPOS REQUERIDOS ==========

  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @IsEnum(NotificationChannel)
  @IsNotEmpty()
  channel: NotificationChannel;

  @IsString()
  @IsNotEmpty()
  recipient: string; // Email, teléfono (E.164) o número WhatsApp

  @IsUUID()
  @IsNotEmpty()
  templateId: string;

  // ========== CAMPOS OPCIONALES GENERALES ==========

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string; // ISO date string

  @IsOptional()
  @IsString()
  companyName?: string;

  // ========== CAMPOS ESPECÍFICOS PARA EMAIL ==========

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsBoolean()
  useLogo?: boolean;

  // ========== CAMPOS ESPECÍFICOS PARA WHATSAPP Y SMS ==========

  /**
   * Número de teléfono en formato E.164
   * Ejemplo: +54911XXXXXXXX
   */
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  /**
   * URL de media para enviar (imagen, documento, audio, video)
   * Soportado en: WhatsApp, SMS
   */
  @IsOptional()
  @IsString()
  @IsUrl()
  mediaUrl?: string;

  /**
   * Tipo de media: 'image', 'document', 'audio', 'video'
   * Soportado en: WhatsApp, SMS
   */
  @IsOptional()
  @IsEnum(['text', 'image', 'document', 'audio', 'video'])
  mediaType?: string;

  /**
   * Descripción de la media
   * Soportado en: WhatsApp
   */
  @IsOptional()
  @IsString()
  mediaCaption?: string;

  // ========== CAMPOS DE CONFIGURACIÓN ==========

  @IsOptional()
  @IsObject()
  config?: {
    provider?: 'sendgrid' | 'smtp' | 'twilio';
    apiKey?: string;
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
      auth: { user: string; pass: string };
    };
    twilio?: {
      accountSid: string;
      authToken: string;
      fromNumber: string;
    };
  };

  // ========== CAMPOS DE WEBHOOK (Interno) ==========

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  /**
   * Flag para validar firma de Twilio en webhooks
   */
  @IsOptional()
  @IsBoolean()
  validateTwilioSignature?: boolean;
}

/**
 * DTO para crear logs de notificaciones
 * Se usa internamente en el worker
 */
export class CreateNotificationLogDto {
  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsEnum(NotificationChannel)
  @IsNotEmpty()
  channel: NotificationChannel;

  @IsString()
  @IsNotEmpty()
  recipient: string;

  @IsEnum(NotificationStatus)
  @IsNotEmpty()
  status: NotificationStatus;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsString()
  messageSid?: string; // ID del proveedor (Twilio, SendGrid, etc)

  @IsOptional()
  @IsObject()
  metadata?: {
    provider?: string;
    attempts?: number;
    templateId?: string;
    mediaUrl?: string;
    mediaType?: string;
    timestamp?: string;
    duration?: number; // En ms
    retryCount?: number;
  };
}

/**
 * DTO para respuesta de envío de notificación
 * (Respuesta del servidor)
 */
export class SendNotificationResponseDto {
  success: boolean;
  message: string;
  data: {
    jobId: string;
    recipient: string;
    channel: NotificationChannel;
    companyId: string;
    status: 'queued' | 'scheduled' | 'sent' | 'failed';
    templateId: string;
    scheduledAt?: string;
  };
  checkStatus?: string; // URL para verificar estado
  error?: string;
}

/**
 * DTO para respuesta de estado de job
 */
export class JobStatusResponseDto {
  success: boolean;
  jobId: string;
  state: string; // 'queued', 'active', 'completed', 'failed', 'delayed'
  progress?: number;
  data: SendNotificationDto;
  timestamps: {
    created: Date;
    processed?: Date;
    finished?: Date;
  };
  attempts: number;
  failedReason?: string;
  error?: string;
}

/**
 * DTO para eventos de webhook de Twilio
 */
export class TwilioWebhookEventDto {
  MessageSid: string; // SID del mensaje
  AccountSid: string; // SID de la cuenta
  From: string; // Número o email del remitente
  To: string; // Destinatario
  MessageStatus: string; // 'queued', 'sent', 'delivered', 'failed', 'undelivered'
  ErrorCode?: number; // Código de error si hay
  ErrorMessage?: string; // Mensaje de error si hay
  NumMedia?: number; // Cantidad de media
  NumSegments?: string; // Cantidad de segmentos (SMS)
  SmsStatus?: string; // Estado del SMS específicamente
  ApiVersion?: string; // Versión de API de Twilio
}

/**
 * DTO para estadísticas de cola
 */
export class QueueStatsResponseDto {
  success: boolean;
  timestamp: string;
  queue: string;
  channel: NotificationChannel;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    total: number;
  };
  config: {
    concurrency: number;
    attempts: number;
    backoff: number;
  };
  error?: string;
}

/**
 * DTO para listar notificaciones programadas
 */
export class ScheduledNotificationResponseDto {
  success: boolean;
  data: Array<{
    id: string;
    recipient: string;
    companyId: string;
    templateId: string;
    channel: NotificationChannel;
    variables?: Record<string, any>;
    scheduledAt: string;
    status: string;
    createdAt: string;
  }>;
  count: number;
  timestamp: string;
  error?: string;
}