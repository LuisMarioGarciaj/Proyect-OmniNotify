// create-template.dto.ts
import { NotificationChannel } from '../entities/template.entity';

export class CreateTemplateDto {
  name: string;
  channel: NotificationChannel;
  content: string;
  companyId: string;
  provider_template_id?: string;
  category?: string;
  description?: string;
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class UpdateTemplateDto {
  name?: string;
  channel?: NotificationChannel;
  content?: string;
  companyId?: string;
  provider_template_id?: string;
  category?: string;
  description?: string;
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
}