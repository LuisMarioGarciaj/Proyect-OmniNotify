// src/modules/credits/dto/credit-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { CreditTransactionType, NotificationChannel } from '../entities/credit-transaction.entity';

/**
 * Respuesta al consultar el balance de créditos
 */
export class CreditBalanceResponseDto {
  @ApiProperty({ example: 850 })
  currentBalance: number;

  @ApiProperty({ example: '2838f6ef-6745-438e-9b85-394ebf117e1f' })
  companyId: string;

  @ApiProperty({ example: '2026-02-19T10:30:00Z' })
  lastUpdated: string;
}

/**
 * Respuesta de una transacción individual
 */
export class CreditTransactionResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  id: string;

  @ApiProperty({ enum: CreditTransactionType, example: 'PURCHASE' })
  type: CreditTransactionType;

  @ApiProperty({ example: 1000 })
  amount: number;

  @ApiProperty({ example: 500 })
  balanceBefore: number;

  @ApiProperty({ example: 1500 })
  balanceAfter: number;

  @ApiProperty({ enum: NotificationChannel, example: 'WHATSAPP', nullable: true })
  channel?: NotificationChannel;

  @ApiProperty({ example: 'Compra de 1000 créditos vía QR' })
  description: string;

  @ApiProperty({ example: '2026-02-19T10:30:00Z' })
  createdAt: string;

  @ApiProperty({ required: false })
  metadata?: Record<string, any>;
}

/**
 * Respuesta con historial paginado
 */
export class CreditHistoryResponseDto {
  @ApiProperty({ type: [CreditTransactionResponseDto] })
  transactions: CreditTransactionResponseDto[];

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  perPage: number;

  @ApiProperty({ example: 850 })
  currentBalance: number;
}

/**
 * Respuesta al comprar créditos
 */
export class PurchaseCreditsResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Créditos comprados exitosamente' })
  message: string;

  @ApiProperty({ type: CreditTransactionResponseDto })
  transaction: CreditTransactionResponseDto;

  @ApiProperty({ example: 1500 })
  newBalance: number;
}