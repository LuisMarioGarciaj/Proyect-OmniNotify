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
}