// src/modules/credits/dto/credit-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class BalanceResponseDto {
  @ApiProperty({ description: 'Créditos disponibles', example: 974 })
  credits: number;

  @ApiProperty({ description: 'Nombre de la empresa', example: 'Papas' })
  companyName: string;
}

// ... resto de las interfaces igual ...
export class RechargeResponseDto {
  @ApiProperty({ description: 'ID de la recarga', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'ID de transacción de Yopago', example: '650484' })
  transactionId: string;

  @ApiProperty({ description: 'ID del QR (solo para método QR)', required: false, example: '55406677' })
  qrId?: string;

  @ApiProperty({ description: 'Código QR en base64 (solo para método QR)', required: false })
  qrCode?: string;

  @ApiProperty({ description: 'URL de pago (solo para método CARD)', required: false, example: 'https://yopago.com.bo/pay/123' })
  paymentUrl?: string;

  @ApiProperty({ description: 'Monto en bolivianos', example: 50 })
  amount: number;

  @ApiProperty({ description: 'Créditos a comprar', example: 50 })
  credits: number;

  @ApiProperty({ description: 'Fecha de expiración', example: '2026-03-05T04:14:17.000Z' })
  expiresAt: Date;

  @ApiProperty({ description: 'Estado del QR', enum: ['PENDING', 'PAID', 'EXPIRED', 'CANCELLED'], example: 'PENDING' })
  qrStatus: string;

  @ApiProperty({ description: 'Estado del pago', enum: ['PENDING', 'PAID', 'EXPIRED', 'FAILED'], example: 'PENDING' })
  paymentStatus: string;
}

export class VerifyResponseDto {
  @ApiProperty({ description: 'ID de la recarga', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'ID de transacción de Yopago', example: '650484' })
  transactionId: string;

  @ApiProperty({ description: 'ID del QR (solo para método QR)', required: false, example: '55406677' })
  qrId?: string;

  @ApiProperty({ description: 'Estado del QR', enum: ['PENDING', 'PAID', 'EXPIRED', 'CANCELLED'], example: 'PAID' })
  qrStatus: string;

  @ApiProperty({ description: 'Estado del pago', enum: ['PENDING', 'PAID', 'EXPIRED', 'FAILED'], example: 'PAID' })
  paymentStatus: string;

  @ApiProperty({ description: 'Fecha de pago', required: false, example: '2026-03-04T04:20:00.000Z' })
  paidAt?: Date;

  @ApiProperty({ description: 'Créditos comprados', example: 50 })
  credits: number;

  @ApiProperty({ description: 'Monto pagado', example: 50 })
  amount: number;
}

export class RechargeHistoryDto {
  @ApiProperty({ description: 'Total de registros', example: 25 })
  total: number;

  @ApiProperty({ description: 'Límite de registros por página', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Offset (desplazamiento)', example: 0 })
  offset: number;

  @ApiProperty({ type: [RechargeResponseDto], description: 'Lista de recargas' })
  data: RechargeResponseDto[];
}

export class ChannelCostResponseDto {
  @ApiProperty({ description: 'Canal', enum: ['EMAIL', 'SMS', 'WHATSAPP'], example: 'SMS' })
  channel: string;

  @ApiProperty({ description: 'Costo por mensaje en créditos', example: 2 })
  cost: number;
}