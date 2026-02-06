import { IsEmail, IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendEmailDto {
  @ApiProperty({ example: '25a63d10-eff4-11f0-86e6-a2aaf909b30d' })
  @IsString()
  companyId: string;

  @ApiProperty({ example: 'cliente@ejemplo.com' })
  @IsEmail()
  recipient: string;

  @ApiProperty({ example: 'Bienvenido a nuestro sistema' })
  @IsString()
  subject: string;

  @ApiProperty({ 
    example: '<h1>Hola {{nombre}}</h1><p>Gracias por registrarte.</p>',
    description: 'Contenido HTML con variables {{variable}}'
  })
  @IsString()
  html: string;

  @ApiProperty({ 
    example: { nombre: 'Juan Pérez', codigo: 'ABC123' },
    required: false 
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @ApiProperty({ 
    example: '2024-01-23T09:00:00.000Z',
    required: false,
    description: 'Fecha programada en formato ISO'
  })
  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @ApiProperty({ 
    example: 'texto-plano opcional',
    required: false 
  })
  @IsOptional()
  @IsString()
  text?: string;
}

export class TestEmailDto {
  @ApiProperty({ example: 'cliente@ejemplo.com' })
  @IsEmail()
  to: string;

  @ApiProperty({ 
    example: 'sendgrid',
    enum: ['sendgrid', 'smtp'] 
  })
  @IsEnum(['sendgrid', 'smtp'])
  provider: 'sendgrid' | 'smtp';

  @ApiProperty({ 
    example: 'SG.xxxxx',
    required: false 
  })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiProperty({ 
    example: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'tu_email@gmail.com',
        pass: 'tu_password'
      }
    },
    required: false 
  })
  @IsOptional()
  @IsObject()
  smtpConfig?: any;
}