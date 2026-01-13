import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
// import { Company } from '../../companies/entities/company.entity';
import { ScheduledNotification } from '../../notifications/entities/scheduled-notification.entity';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text' })
  content: string; // "Hola {{name}}, tu código es {{code}}"

  // ID de la plantilla aprobada en Facebook/WhatsApp o SendGrid
  @Column({ type: 'varchar', length: 150, nullable: true })
  provider_template_id: string;

  // Relaciones
  // @ManyToOne(() => Company, (company) => company.templates)
  // @JoinColumn({ name: 'company_id' })
  // company: Company;

  @OneToMany(() => ScheduledNotification, (sched) => sched.template)
  scheduled_notifications: ScheduledNotification[];
}