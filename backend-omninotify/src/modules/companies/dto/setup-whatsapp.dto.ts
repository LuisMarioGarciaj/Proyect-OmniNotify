// src/modules/companies/dto/setup-whatsapp.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class SetupWhatsappDto {
  @IsString()
  @IsNotEmpty()
  token: string; // El Bearer token de Nexo

  @IsString()
  @IsOptional()
  @IsIn(['production', 'sandbox'])
  environment?: 'production' | 'sandbox';

  @IsString()
  @IsOptional()
  configuredBy?: string; // Nombre o email del usuario que lo configuró
}