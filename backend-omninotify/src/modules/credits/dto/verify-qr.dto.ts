// src/modules/credits/dto/verify-qr.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyQrDto {
  @ApiProperty({ description: 'ID de transacción de Yopago', example: '650484' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiProperty({ description: 'ID del QR', example: '55406677' })
  @IsString()
  @IsNotEmpty()
  qrId: string;
}