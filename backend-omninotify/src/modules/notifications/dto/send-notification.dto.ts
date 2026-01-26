import { IsEnum, IsString, IsObject, IsOptional, IsUUID, IsNotEmpty, IsDateString } from 'class-validator';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

export class SendNotificationDto {
  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @IsEnum(NotificationChannel)
  @IsNotEmpty()
  channel: NotificationChannel;

  @IsString()
  @IsNotEmpty()
  recipient: string;

  @IsUUID()
  @IsNotEmpty()
  templateId: string;

  @IsObject()
  @IsOptional()
  variables?: Record<string, any>;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  // IMPORTANTE: AGREGA contactId para mapear con tu BD
  @IsOptional()
  @IsUUID()
  contactId?: string; // Mapea con contact_id en Notification_Logs
}