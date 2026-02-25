// src/modules/credits/dto/generate-url.dto.ts
import { IsString, IsOptional, IsNumber, Min, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateUrlDto {
  @ApiProperty({ description: 'Monto a pagar', example: 100 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ description: 'Código de transacción único', example: 'URL-123456' })
  @IsOptional()
  @IsString()
  codeTransaction?: string;

  @ApiPropertyOptional({ description: 'URL de éxito', example: 'https://omninotify.com/exito' })
  @IsOptional()
  @IsString()
  urlSuccess?: string;

  @ApiPropertyOptional({ description: 'URL de fallo', example: 'https://omninotify.com/fallo' })
  @IsOptional()
  @IsString()
  urlFailed?: string;

  @ApiPropertyOptional({ description: 'Nombre del pagador', example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  billName?: string;

  @ApiPropertyOptional({ description: 'NIT del pagador', example: '123456789' })
  @IsOptional()
  @IsString()
  billNit?: string;

  @ApiPropertyOptional({ description: 'Email del pagador', example: 'cliente@ejemplo.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Generar factura (1=Sí, 0=No)', example: '1' })
  @IsOptional()
  @IsString()
  generateBill?: string;

  @ApiPropertyOptional({ description: 'Concepto del pago', example: 'Recarga de créditos' })
  @IsOptional()
  @IsString()
  concept?: string;

  @ApiPropertyOptional({ description: 'Moneda', example: 'BOB' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Mensaje de pago', example: 'Gracias por tu compra' })
  @IsOptional()
  @IsString()
  messagePayment?: string;

  @ApiPropertyOptional({ description: 'Código externo', example: '' })
  @IsOptional()
  @IsString()
  codeExternal?: string;
}