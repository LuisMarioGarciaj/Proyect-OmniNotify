import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';
import { NotificationChannel } from '../../templates/entities/template.entity';

export enum NotificationLogStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  DELIVERED = 'DELIVERED'
}

@Entity('Notification_Logs')
export class NotificationLog {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ type: 'char', length: 36 })
  company_id: string;

  @Column({ type: 'char', length: 36, nullable: true })
  contact_id: string | null; // ← nullable

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 150 })
  recipient: string;

  @Column({ type: 'enum', enum: NotificationLogStatus })
  status: NotificationLogStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string | null; // ← nullable

  // IMPORTANTE: job_id debe ser nullable
  @Column({ type: 'varchar', length: 100, nullable: true })
  job_id: string | null; // ← AÑADE | null

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}