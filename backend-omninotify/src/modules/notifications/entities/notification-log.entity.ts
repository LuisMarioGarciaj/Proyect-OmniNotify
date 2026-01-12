import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { Contact } from '../../contacts/entities/contact.entity';
import { NotificationChannel } from '../../templates/entities/template.entity';

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  DELIVERED = 'DELIVERED',
}

@Entity('notification_logs')
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  contact_id: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 150 })
  recipient: string; // Email o teléfono

  @Column({ type: 'enum', enum: NotificationStatus })
  status: NotificationStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  job_id: string; // Referencia a BullMQ

  @CreateDateColumn()
  created_at: Date;

  // Relaciones
  @ManyToOne(() => Company, (company) => company.notification_logs)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Contact, { nullable: true })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;
}