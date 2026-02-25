// src/modules/credits/dto/verify-qr.dto.ts
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyQrDto {
  @ApiProperty({ description: 'ID de la transacción', example: '650484' })
  @IsString()
  transactionId: string;

  @ApiProperty({ description: 'ID del QR', example: '55406677' })
  @IsString()
  qrId: string;

  @ApiPropertyOptional({ description: 'Código de empresa (opcional, usa el default si no se envía)' })
  @IsOptional()
  @IsString()
  companyCode?: string;
}