import { Entity, PrimaryColumn, Column } from 'typeorm';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP'
}

@Entity('Template')
export class Template {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ type: 'char', length: 36 })
  company_id: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text' })
  content: string;

  // IMPORTANTE: Debe ser nullable
  @Column({ type: 'varchar', length: 150, nullable: true })
  provider_template_id: string | null; // Añade | null aquí
  scheduledNotifications: any;
}