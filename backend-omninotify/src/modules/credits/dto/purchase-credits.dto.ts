// src/modules/credits/dto/purchase-credits.dto.ts
import { IsInt, IsPositive, IsString, IsOptional, IsObject, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para comprar créditos
 * Usado cuando el usuario paga con QR, tarjeta, etc.
 */
export class PurchaseCreditsDto {
  @ApiProperty({
    description: 'Cantidad de créditos a comprar',
    example: 1000,
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Método de pago utilizado',
    example: 'QR',
    enum: ['QR', 'CARD', 'BANK_TRANSFER', 'CASH'],
  })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional({
    description: 'ID de transacción del proveedor de pago',
    example: 'QR-123456789',
  })
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiPropertyOptional({
    description: 'Metadata adicional del pago',
    example: { qrProvider: 'Stripe', currency: 'BOB' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}