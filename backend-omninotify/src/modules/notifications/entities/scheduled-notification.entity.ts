import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { NotificationChannel } from '../dto/send-notification.dto';

// Según tu base de datos, los estados son: SCHEDULED, PROCESSING, SENT, CANCELLED
export enum ScheduledNotificationStatus {
  SCHEDULED = 'SCHEDULED',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  CANCELLED = 'CANCELLED'
  // NOTA: No hay FAILED en tu base de datos para Scheduled_Notification
}

@Entity('Scheduled_Notification')
@Index(['companyId', 'status'])
@Index(['scheduledAt', 'status'])
export class ScheduledNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId: string;

  @Column({ name: 'template_id', type: 'char', length: 36 })
  templateId: string;

  @Column({ 
    type: 'enum', 
    enum: NotificationChannel,
    enumName: 'notification_channel_enum',
    default: NotificationChannel.EMAIL 
  })
  channel: NotificationChannel;

  @Column({ length: 150 })
  recipient: string;

  @Column({ type: 'json', nullable: true })
  variables: Record<string, any> | null;

  @Column({ name: 'scheduled_at', type: 'datetime' })
  scheduledAt: Date;

  @Column({ 
    type: 'enum', 
    enum: ScheduledNotificationStatus,
    enumName: 'scheduled_notification_status_enum',
    default: ScheduledNotificationStatus.SCHEDULED 
  })
  status: ScheduledNotificationStatus;
}