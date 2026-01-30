// src/modules/notifications/entities/notification-log.entity.ts
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn,
  Index 
} from 'typeorm';
import { 
  NotificationChannel, 
  NotificationStatus 
} from '../dto/send-notification.dto';

@Entity('Notification_Logs') // ✅ Nombre de tabla en plural
@Index(['companyId'])
@Index(['contactId'])
@Index(['jobId'])
@Index(['status'])
@Index(['createdAt'])
export class NotificationLog { // ✅ Nombre de clase en singular
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId: string;

  @Column({ name: 'contact_id', type: 'char', length: 36, nullable: true })
  contactId: string;

  @Column({ 
    type: 'enum', 
    enum: NotificationChannel 
  })
  channel: NotificationChannel;

  @Column({ length: 150 })
  recipient: string;

  @Column({ 
    type: 'enum', 
    enum: NotificationStatus,
    default: NotificationStatus.PENDING 
  })
  status: NotificationStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'job_id', length: 100, nullable: true })
  jobId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}