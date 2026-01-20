import { NotificationChannel } from '../entities/template.entity';

export class CreateTemplateDto {
  name: string;
  channel: NotificationChannel;
  content: string;
  companyId: string;
  provider_template_id?: string;
}

export class UpdateTemplateDto {
  name?: string;
  channel?: NotificationChannel;
  content?: string;
  companyId?: string;
  provider_template_id?: string;
}