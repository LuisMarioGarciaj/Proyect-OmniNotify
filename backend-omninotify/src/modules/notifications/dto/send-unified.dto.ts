import { 
  IsEnum, IsString, IsOptional, IsObject, IsUrl, IsIn,
  ValidateIf, IsISO8601, IsArray, ValidateNested, IsBoolean 
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

// ─── Programación ─────────────────────────────────────────────────────────────
export class SchedulingDto {
  @ApiProperty({ 
    description: '¿Es programado?',
    example: false 
  })
  @IsBoolean()
  @IsOptional()
  is_scheduled?: boolean;

  @ApiPropertyOptional({ 
    description: 'Fecha de envío programado (ISO 8601 UTC)',
    example: '2026-02-20T15:00:00Z'
  })
  @ValidateIf(o => o.is_scheduled === true)
  @IsISO8601()
  send_at?: string;
}

// ─── Adjunto para WhatsApp ────────────────────────────────────────────────────
export class AttachmentDto {
  @ApiProperty({ 
    description: 'URL pública del archivo (o data URL en base64)',
    example: 'https://cdn.example.com/image.jpg'
  })
  @IsString()
  url: string;

  @ApiProperty({ 
    description: 'Tipo de archivo',
    enum: ['image', 'video', 'document', 'audio'],
    example: 'image'
  })
  @IsIn(['image', 'video', 'document', 'audio'])
  type: 'image' | 'video' | 'document' | 'audio';

  @ApiPropertyOptional({ 
    description: 'Nombre del archivo (opcional)',
    example: 'factura.pdf' 
  })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({ 
    description: 'Caption o texto que acompaña el archivo (solo WhatsApp)',
    example: 'Aquí está tu factura'
  })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ 
    description: 'MIME type del archivo',
    example: 'image/jpeg'
  })
  @IsOptional()
  @IsString()
  mimeType?: string;
}

// ─── DTO Principal ────────────────────────────────────────────────────────────

/**
 * DTO UNIFICADO para envío de notificaciones
 * 
 * Soporta: EMAIL, SMS, WHATSAPP
 * Con scheduling automático y adjuntos para WhatsApp
 * 
 * @example Envío inmediato
 * ```json
 * {
 *   "channel": "WHATSAPP",
 *   "templateId": "uuid-here",
 *   "recipient": "+59176131645",
 *   "variables": { "name": "Juan" },
 *   "scheduling": { "is_scheduled": false }
 * }
 * ```
 * 
 * @example Envío programado con adjunto
 * ```json
 * {
 *   "channel": "WHATSAPP",
 *   "templateAlias": "ORDER_CONFIRMATION",
 *   "recipient": "+59176131645",
 *   "variables": { "orderNumber": "123" },
 *   "scheduling": {
 *     "is_scheduled": true,
 *     "send_at": "2026-02-20T15:00:00Z"
 *   },
 *   "attachments": [{
 *     "url": "https://cdn.com/image.jpg",
 *     "type": "image",
 *     "caption": "Tu orden está lista"
 *   }]
 * }
 * ```
 */
export class SendUnifiedNotificationDto {
  // ═════════════════════════════════════════════════════════════════════════
  // ❌ NO enviar companyId — se extrae automáticamente del JWT
  // ═════════════════════════════════════════════════════════════════════════
  
  @ApiProperty({ 
    description: 'Canal de notificación',
    enum: NotificationChannel,
    example: NotificationChannel.WHATSAPP
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ 
    description: 'Destinatario: email (para EMAIL) o número con formato E.164 (para SMS/WHATSAPP)',
    examples: {
      email: { value: 'cliente@example.com', summary: 'Email' },
      phone: { value: '+59176131645', summary: 'Teléfono Bolivia' }
    }
  })
  @IsString()
  recipient: string;

  // ═════════════════════════════════════════════════════════════════════════
  // Template: Soporta ALIAS (recomendado) o ID (compatible)
  // ═════════════════════════════════════════════════════════════════════════
  
  @ApiPropertyOptional({ 
    description: '✅ RECOMENDADO: Alias de la plantilla (ej: "WELCOME_EMAIL")',
    example: 'ORDER_CONFIRMATION'
  })
  @IsOptional()
  @IsString()
  templateAlias?: string;

  @ApiPropertyOptional({ 
    description: 'UUID de la plantilla (compatible con código antiguo)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  })
  @IsOptional()
  @IsString()
  templateId?: string;

  // ═════════════════════════════════════════════════════════════════════════
  // CONTENIDO DIRECTO (sin template) - NUEVOS CAMPOS
  // ═════════════════════════════════════════════════════════════════════════
  
  @ApiPropertyOptional({ 
    description: 'Contenido directo del mensaje (HTML para EMAIL, texto plano para SMS/WHATSAPP)',
    example: '<h1>¡Hola {{nombre}}!</h1><p>Bienvenido a {{empresa}}</p>'
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ 
    description: 'Asunto del email (solo para canal EMAIL)',
    example: 'Bienvenido a nuestra plataforma'
  })
  @IsOptional()
  @IsString()
  subject?: string;

  // ═════════════════════════════════════════════════════════════════════════
  // Variables para reemplazar en el template: {{ name }}, {{ orderNumber }}
  // ═════════════════════════════════════════════════════════════════════════
  
  @ApiPropertyOptional({ 
    description: 'Variables para inyectar en la plantilla',
    example: { 
      name: 'María García', 
      orderNumber: 'ORD-12345',
      company: 'Mi Empresa S.A.'
    }
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  // ═════════════════════════════════════════════════════════════════════════
  // SCHEDULING — Envío inmediato o programado
  // ═════════════════════════════════════════════════════════════════════════
  
  @ApiPropertyOptional({ 
    description: 'Configuración de programación (inmediato o futuro)',
    type: SchedulingDto,
    examples: {
      immediate: {
        value: { is_scheduled: false },
        summary: 'Envío inmediato'
      },
      scheduled: {
        value: { 
          is_scheduled: true, 
          send_at: '2026-02-20T15:00:00Z' 
        },
        summary: 'Envío programado'
      }
    }
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SchedulingDto)
  scheduling?: SchedulingDto;

  // ═════════════════════════════════════════════════════════════════════════
  // ATTACHMENTS — Solo para WhatsApp (imágenes, videos, documentos, audio)
  // ═════════════════════════════════════════════════════════════════════════
  
  @ApiPropertyOptional({ 
    description: 'Archivos adjuntos (solo WhatsApp). Nexo API soporta un archivo a la vez.',
    type: [AttachmentDto],
    example: [{
      url: 'https://cdn.example.com/factura.pdf',
      type: 'document',
      filename: 'Factura_123.pdf',
      caption: 'Tu factura del mes'
    }]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  // ═════════════════════════════════════════════════════════════════════════
  // METADATA — Información adicional para logs o tracking interno
  // ═════════════════════════════════════════════════════════════════════════
  
  @ApiPropertyOptional({ 
    description: 'Metadata adicional para logs internos',
    example: { 
      sentFrom: 'web-app',
      userId: 'user-123',
      campaignId: 'campaign-456'
    }
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}