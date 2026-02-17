import { IsUUID, IsString, IsObject, IsOptional, IsDateString, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendSmsDto {
  @ApiProperty({ 
    example: '25a63d10-eff4-11f0-86e6-a2aaf909b30d',
    description: 'ID de la empresa'
  })
  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @ApiProperty({ 
    example: '+34612345678',
    description: 'Número de teléfono en formato E.164'
  })
  @IsString()
  @IsNotEmpty()
  recipient: string; // Número de teléfono

  @ApiProperty({ 
    example: 'Hola, este es un mensaje de prueba',
    description: 'Texto del mensaje SMS'
  })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ 
    example: '+15551234567',
    description: 'Número de origen (opcional)',
    required: false
  })
  @IsOptional()
  @IsString()
  fromNumber?: string;

  @ApiProperty({ 
    example: { nombre: 'Juan', codigo: 'ABC123' },
    description: 'Variables para reemplazar en plantillas',
    required: false
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @ApiProperty({ 
    example: '2024-01-23T09:00:00.000Z',
    description: 'Fecha programada en formato ISO',
    required: false
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiProperty({ 
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID de la plantilla (opcional)',
    required: false
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiProperty({ 
    description: 'Configuración del proveedor (opcional - si no se envía, se usará la de la empresa)',
    required: false,
    example: {
      provider: 'vonage',
      apiKey: 'VG9rZW4x',
      apiSecret: 'U2VjcmV0MQ',
      fromNumber: '+15551234567'
    }
  })
  @IsOptional()
  @IsObject()
  config?: {
    provider?: 'vonage' | 'twilio';
    apiKey?: string;
    apiSecret?: string;
    fromNumber?: string;
    accountSid?: string;
    authToken?: string;
  };
}

// DTO para test de SMS
export class TestSmsDto {
  @ApiProperty({ 
    example: '+34612345678',
    description: 'Número de teléfono en formato E.164'
  })
  @IsString()
  @IsNotEmpty()
  to: string;

  @ApiProperty({ 
    example: 'vonage',
    enum: ['vonage', 'twilio'],
    description: 'Proveedor de SMS'
  })
  @IsEnum(['vonage', 'twilio'])
  @IsNotEmpty()
  provider: 'vonage' | 'twilio';

  @ApiProperty({ 
    example: 'Hola, este es un mensaje de prueba',
    description: 'Texto del mensaje (opcional - si no se envía, se genera uno automático)',
    required: false
  })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({ 
    example: 'VG9rZW4x',
    description: 'API Key del proveedor',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @ApiProperty({ 
    example: 'U2VjcmV0MQ',
    description: 'API Secret del proveedor',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  apiSecret: string;

  @ApiProperty({ 
    example: '+15551234567',
    description: 'Número de origen',
    required: false
  })
  @IsOptional()
  @IsString()
  fromNumber?: string;

  // Para Twilio
  @ApiProperty({ 
    example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    description: 'Account SID de Twilio',
    required: false
  })
  @IsOptional()
  @IsString()
  accountSid?: string;

  @ApiProperty({ 
    example: 'auth_token_here',
    description: 'Auth Token de Twilio',
    required: false
  })
  @IsOptional()
  @IsString()
  authToken?: string;

  @ApiProperty({ 
    description: 'Metadatos adicionales',
    required: false,
    example: {
      companyName: 'Mi Empresa',
      companyId: '25a63d10-eff4-11f0-86e6-a2aaf909b30d',
      testType: 'connection_test'
    }
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    companyName?: string;
    companyId?: string;
    testType?: string;
  };
}