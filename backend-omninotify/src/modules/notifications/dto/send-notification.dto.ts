import { 
  IsEnum, 
  IsString, 
  IsObject, 
  IsOptional, 
  IsUUID, 
  IsNotEmpty, 
  IsDateString,
  IsEmail,
  IsBoolean
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
  DELIVERED = 'DELIVERED'
}

export class SendNotificationDto {
  // Campos requeridos según tu BD
  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @IsEnum(NotificationChannel)
  @IsNotEmpty()
  channel: NotificationChannel;

  @IsString()
  @IsNotEmpty()
  recipient: string;  // Email o teléfono

  @IsUUID()
  @IsNotEmpty()
  templateId: string;

  // Campos opcionales
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  // Campos adicionales para EmailController
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
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsBoolean()
  useLogo?: boolean;

  @IsOptional()
  @IsObject()
  config?: {
    provider?: 'sendgrid' | 'smtp';
    apiKey?: string;
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
      auth: { user: string; pass: string };
    };
  };
}

// DTO para logs
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
}