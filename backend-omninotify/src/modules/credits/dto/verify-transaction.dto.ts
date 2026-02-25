// src/modules/credits/dto/verify-transaction.dto.ts
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyTransactionDto {
  @ApiProperty({ description: 'ID de la transacción', example: '668042' })
  @IsString()
  transactionId: string;
}