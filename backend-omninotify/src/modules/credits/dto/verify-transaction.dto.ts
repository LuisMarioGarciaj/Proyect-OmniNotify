// src/modules/credits/dto/verify-transaction.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyTransactionDto {
  @ApiProperty({ description: 'ID de transacción de Yopago', example: '668042' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;
}