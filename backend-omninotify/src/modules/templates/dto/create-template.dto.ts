// src/modules/templates/dto/create-template.dto.ts
import { IsString, IsIn, IsOptional, MinLength } from 'class-validator';
import { NotificationChannel } from '../entities/template.entity';

export class CreateTemplateDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsIn(['EMAIL', 'SMS', 'WHATSAPP'])
  channel: NotificationChannel;

  @IsString()
  @MinLength(10)
  content: string;

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