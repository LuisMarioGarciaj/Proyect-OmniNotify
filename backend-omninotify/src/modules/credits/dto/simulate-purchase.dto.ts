// src/modules/credits/dto/simulate-purchase.dto.ts
import { IsInt, IsPositive, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SimulatePurchaseDto {
  @ApiProperty({
    description: 'Cantidad de créditos a agregar (simulación)',
    example: 1000,
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  @Min(1)
  amount: number;
}