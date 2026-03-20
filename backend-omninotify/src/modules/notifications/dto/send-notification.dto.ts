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
  IsUrl,
  IsArray,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
}

export enum ScheduledNotificationStatus {
  SCHEDULED = 'SCHEDULED',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export class SchedulingDto {
  @IsBoolean()
  @IsNotEmpty()
  is_scheduled: boolean;

  @IsOptional()
  @IsDateString()
  send_at?: string;
}

export class AttachmentDto {
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @IsEnum(['image', 'video', 'document', 'audio'])
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  caption?: string;
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
  recipient: string; // Email o teléfono (E.164)

  // ========== TEMPLATE (AHORA TODOS SON OPCIONALES) ==========
  @IsOptional()
  @IsString()
  templateAlias?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  // ========== CAMPOS OPCIONALES GENERALES ==========
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @ValidateNested()
  @Type(() => SchedulingDto)
  scheduling?: SchedulingDto;

  @IsOptional()
  @IsString()
  companyName?: string;

  // ========== CONTENIDO DIRECTO (AHORA PERMITIDO SIN TEMPLATE) ==========
  @IsOptional()
  @IsString()
  content?: string;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  // ========== CAMPOS ESPECÍFICOS PARA WHATSAPP Y SMS ==========
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  mediaUrl?: string;

  @IsOptional()
  @IsEnum(['text', 'image', 'document', 'audio', 'video'])
  mediaType?: string;

  @IsOptional()
  @IsString()
  mediaCaption?: string;

  // ========== CAMPOS DE CONFIGURACIÓN ==========
  @IsOptional()
  @IsObject()
  config?: {
    provider?: 'sendgrid' | 'smtp' | 'twilio' | 'vonage';
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
  messageSid?: string;

  @IsOptional()
  @IsObject()
  metadata?: {
    provider?: string;
    attempts?: number;
    templateId?: string;
    mediaUrl?: string;
    mediaType?: string;
    timestamp?: string;
    duration?: number;
    retryCount?: number;
  };
}

/**
 * DTO para respuesta de envío de notificación
 */
export class SendNotificationResponseDto {
  success: boolean;
  message: string;
  data?: {
    id?: string;
    jobId: string;
    recipient: string;
    channel: NotificationChannel;
    companyId: string;
    status: 'queued' | 'scheduled' | 'sent' | 'failed';
    templateId?: string;
    scheduledAt?: string;
    hasAttachments?: boolean;
  };
  checkStatus?: string;
  error?: string;
}