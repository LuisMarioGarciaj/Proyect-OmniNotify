// src/modules/credits/dto/simulate-deduction.dto.ts
import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationChannel } from '../entities/credit-transaction.entity';

export class SimulateDeductionDto {
  @ApiProperty({
    description: 'Canal de envío a simular',
    enum: NotificationChannel,
    example: 'WHATSAPP',
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({
    description: 'Número o email del destinatario (solo referencia, no se envía nada)',
    example: '+59176131645',
  })
  @IsString()
  recipient: string;
}