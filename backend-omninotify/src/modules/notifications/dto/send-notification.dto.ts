export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export class SendNotificationDto {
  recipient: string;
  subject: string;
  html: string;
  text: string;
  channel: NotificationChannel;
  companyId: string;
  companyName?: string;
  variables?: Record<string, string>;
  scheduledAt?: string;
  templateId?: string;
}