// src/modules/notifications/dto/send-unified.dto.ts
import { 
  IsEnum, IsString, IsOptional, IsObject, 
  ValidateIf, IsISO8601, IsArray, ValidateNested 
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

export class SchedulingDto {
  @ApiProperty({ 
    description: '¿Es programado?',
    example: false 
  })
  @IsOptional()
  is_scheduled?: boolean;

  @ApiPropertyOptional({ 
    description: 'Fecha de envío programado (ISO 8601)',
    example: '2026-02-20T15:00:00Z'
  })
  @ValidateIf(o => o.is_scheduled === true)
  @IsISO8601()
  send_at?: string;
}

export class AttachmentDto {
  @ApiProperty({ example: 'https://cdn.com/file.pdf' })
  @IsString()
  url: string;

  @ApiProperty({ example: 'Factura.pdf' })
  @IsString()
  filename: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  mimeType?: string;
}

/**
 * DTO UNIFICADO para envío de notificaciones
 * Soporta: EMAIL, SMS, WHATSAPP
 * Con scheduling automático
 */
export class SendUnifiedNotificationDto {
  // ========================================
  // ❌ NO enviar companyId (viene del JWT)
  // ========================================
  
  @ApiProperty({ 
    description: 'Canal de notificación',
    enum: NotificationChannel,
    example: NotificationChannel.EMAIL
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ 
    description: 'Destinatario (email o teléfono +59176131645)',
    example: 'cliente@example.com'
  })
  @IsString()
  recipient: string;

  // ========================================
  // Template: Soporta ALIAS o ID (compatible)
  // ========================================
  
  @ApiPropertyOptional({ 
    description: '✅ RECOMENDADO: Alias de la plantilla',
    example: 'WELCOME_EMAIL'
  })
  @IsOptional()
  @IsString()
  templateAlias?: string;

  @ApiPropertyOptional({ 
    description: 'UUID de la plantilla (compatible)',
    example: 'uuid-here'
  })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ 
    description: 'Variables para inyectar en la plantilla',
    example: { name: 'Juan', company: 'Mi Empresa' }
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  // ========================================
  // SCHEDULING (automático)
  // ========================================
  
  @ApiPropertyOptional({ 
    description: 'Configuración de programación',
    type: SchedulingDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SchedulingDto)
  scheduling?: SchedulingDto;

  // ========================================
  // ATTACHMENTS (solo EMAIL/WHATSAPP)
  // ========================================
  
  @ApiPropertyOptional({ 
    description: 'Archivos adjuntos',
    type: [AttachmentDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  // ========================================
  // METADATA ADICIONAL
  // ========================================
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}