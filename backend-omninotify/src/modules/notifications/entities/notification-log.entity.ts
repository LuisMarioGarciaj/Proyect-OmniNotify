import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index
} from 'typeorm';
import { NotificationChannel } from '../dto/send-notification.dto';

// Definimos el Enum aquí para que el Processor lo encuentre con el nombre exacto
export enum NotificationLogStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  DELIVERED = 'DELIVERED'
}

@Entity('Notification_Logs')
@Index(['companyId'])
@Index(['contactId'])
@Index(['jobId'])
@Index(['status'])
@Index(['createdAt'])
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId: string;

  @Column({ name: 'contact_id', type: 'char', length: 36, nullable: true })
  contactId: string | null;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    enumName: 'notification_channel_enum'
  })
  channel: NotificationChannel;

  @Column({ length: 150 })
  recipient: string;

  @Column({
    type: 'enum',
    enum: NotificationLogStatus,
    enumName: 'notification_log_status_enum',
    default: NotificationLogStatus.PENDING
  })
  status: NotificationLogStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'job_id', type: 'varchar', length: 100, nullable: true })
  jobId: string | null;

  @Column({ name: 'attempts', type: 'int', default: 0 })
  // Cuántos intentos de envío se realizaron (actualizado por el processor al SENT o FAILED).
  // 1 = primer intento, 2 = segundo reintento, etc.
  attempts: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}