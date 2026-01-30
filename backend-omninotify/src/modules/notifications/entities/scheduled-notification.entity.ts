// src/modules/notifications/entities/scheduled-notification.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { NotificationChannel } from '../dto/send-notification.dto';

export enum ScheduledNotificationStatus {
  SCHEDULED = 'SCHEDULED',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  CANCELLED = 'CANCELLED'
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
    default: NotificationChannel.EMAIL 
  })
  channel: NotificationChannel;

  @Column({ length: 150 })
  recipient: string;

  @Column({ type: 'json', nullable: true })
  variables: Record<string, any>;

  @Column({ name: 'scheduled_at', type: 'datetime' })
  scheduledAt: Date;

  @Column({ 
    type: 'enum', 
    enum: ScheduledNotificationStatus,
    default: ScheduledNotificationStatus.SCHEDULED 
  })
  status: ScheduledNotificationStatus;

  // ✅ CORRECTO: NO tiene created_at ni updated_at
}