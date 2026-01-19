import { IsEnum, IsString, IsObject, IsOptional, IsUUID, IsNotEmpty, IsDateString } from 'class-validator';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

export class SendNotificationDto {
  @IsUUID()
  @IsNotEmpty()
  companyId: string; // Identificador de la empresa para cargar sus API Keys [cite: 229]

  @IsEnum(NotificationChannel)
  @IsNotEmpty()
  channel: NotificationChannel; //[cite: 231]

  @IsString()
  @IsNotEmpty()
  recipient: string; // Email o Teléfono (Formato E.164 para móvil) [cite: 234]

  @IsUUID()
  @IsNotEmpty()
  templateId: string; // ID de la plantilla a renderizar [cite: 236]

  @IsObject()
  @IsOptional()
  variables?: Record<string, any>; // Ej: { "nombre": "Carlos", "orden": "552" } [cite: 239]

  @IsDateString()
  @IsOptional()
  scheduledAt?: string; // Fecha ISO para envíos programados [cite: 243]
}