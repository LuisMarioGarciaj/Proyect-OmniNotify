// src/modules/credits/dto/generate-url.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional, Min, MaxLength } from 'class-validator';

export class GenerateUrlDto {
  @ApiProperty({ description: 'Monto en bolivianos (Bs)', minimum: 1, example: 50 })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ description: 'Cantidad de créditos a comprar', minimum: 1, example: 50 })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  credits: number;

  @ApiProperty({ description: 'Nombre para la factura', required: false, example: 'Juan Pérez' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  billName?: string;

  @ApiProperty({ description: 'NIT para la factura', required: false, example: '123456789' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  billNit?: string;

  @ApiProperty({ description: 'Email para la factura', required: false, example: 'cliente@email.com' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  email?: string;

  @ApiProperty({ description: 'Concepto del pago', required: false, default: 'Recarga de créditos' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  concept?: string;
}