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
  category?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  variables?: Record<string, any>;

  @IsOptional()
  metadata?: Record<string, any>;

  // NOTA: companyId se obtendrá del JWT, no se envía desde el frontend
}