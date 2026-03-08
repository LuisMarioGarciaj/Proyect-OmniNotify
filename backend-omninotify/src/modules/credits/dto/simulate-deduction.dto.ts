// src/modules/credits/dto/simulate-deduction.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { NotificationChannel } from '../entities/credit-transaction.entity';

export class SimulateDeductionDto {
  @ApiProperty({ description: 'ID de la empresa' })
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @ApiProperty({ enum: NotificationChannel, description: 'Canal de notificación' })
  @IsEnum(NotificationChannel)
  @IsNotEmpty()
  channel: NotificationChannel;

  @ApiProperty({ description: 'Número de destinatarios', minimum: 1, default: 1 })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  recipientCount: number;

  @ApiProperty({ description: 'Descripción de la deducción', required: false })
  @IsString()
  description?: string;
}