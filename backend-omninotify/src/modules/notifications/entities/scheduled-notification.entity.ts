import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
// import { Company } from '../../companies/entities/company.entity';
import { Template } from '../../templates/entities/template.entity';
import { NotificationChannel } from '../../templates/entities/template.entity';

export enum ScheduledNotificationStatus {
  SCHEDULED = 'SCHEDULED',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  CANCELLED = 'CANCELLED',
}

@Entity('scheduled_notifications')
export class ScheduledNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  template_id: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 150 })
  recipient: string; // Email o teléfono

  @Column({ type: 'jsonb', nullable: true })
  variables: Record<string, any>; // Variables para compilar la plantilla

  @Column({ type: 'timestamp with time zone' })
  scheduled_at: Date;

  @Column({
    type: 'enum',
    enum: ScheduledNotificationStatus,
    default: ScheduledNotificationStatus.SCHEDULED,
  })
  status: ScheduledNotificationStatus;

  @CreateDateColumn()
  created_at: Date;

  // Relaciones
  // @ManyToOne(() => Company, (company) => company.scheduled_notifications)
  // @JoinColumn({ name: 'company_id' })
  // company: Company;

  @ManyToOne(() => Template, (template) => template.scheduled_notifications)
  @JoinColumn({ name: 'template_id' })
  template: Template;
}