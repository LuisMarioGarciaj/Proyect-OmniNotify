import { 
  Entity, 
  PrimaryColumn, 
  Column, 
  // ManyToOne, 
  // JoinColumn, 
  CreateDateColumn 
} from 'typeorm';
// import { Template } from '../../templates/entities/template.entity'; // Comenta esto

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP'
}

export enum ScheduledNotificationStatus {
  SCHEDULED = 'SCHEDULED',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  CANCELLED = 'CANCELLED',
}

@Entity('Scheduled_Notification')
export class ScheduledNotification {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ type: 'char', length: 36 })
  company_id: string;

  @Column({ type: 'char', length: 36 })
  template_id: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 150 })
  recipient: string;

  @Column({ type: 'json', nullable: true })
  variables: Record<string, any>;

  @Column({ type: 'datetime' })
  scheduled_at: Date;

  @Column({
    type: 'enum',
    enum: ScheduledNotificationStatus,
    default: ScheduledNotificationStatus.SCHEDULED,
  })
  status: ScheduledNotificationStatus;

  @CreateDateColumn()
  created_at: Date;

  // COMENTA TEMPORALMENTE ESTA RELACIÓN
  // @ManyToOne(() => Template, (template) => template.scheduled_notifications)
  // @JoinColumn({ name: 'template_id' })
  // template: Template;
}