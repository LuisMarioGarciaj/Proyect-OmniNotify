// src/modules/templates/dto/update-template.dto.ts
import { IsString, IsIn, IsOptional, MinLength } from 'class-validator';
import { NotificationChannel } from '../entities/template.entity';

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsIn(['EMAIL', 'SMS', 'WHATSAPP'])
  channel?: NotificationChannel;

  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;

  @IsOptional()
  @IsString()
  provider_template_id?: string;

  @IsOptional()
  @IsString()
  alias?: string; // <-- AÑADIR CAMPO alias como opcional

  @IsOptional()
  category?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  variables?: Record<string, any>;

  @IsOptional()
  metadata?: Record<string, any>;
}