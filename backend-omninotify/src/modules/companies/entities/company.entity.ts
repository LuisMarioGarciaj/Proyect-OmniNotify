import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Contact } from '../../contacts/entities/contact.entity';
import { Tag } from '../../tags/entities/tag.entity';
import { Template } from '../../templates/entities/template.entity';
import { ScheduledNotification } from '../../notifications/entities/scheduled-notification.entity';
import { NotificationLog } from '../../notifications/entities/notification-log.entity';
import { CompanyProviderConfig } from '../../providers/entities/company-provider-config.entity';

export enum CompanyStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150, nullable: false })
  name: string;

  @Column({
    type: 'enum',
    enum: CompanyStatus,
    default: CompanyStatus.ACTIVE,
  })
  status: CompanyStatus;

  @Column({ type: 'jsonb', nullable: true })
  api_keys_config: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  // Relaciones
  @OneToMany(() => User, (user) => user.company, { cascade: true })
  users: User[];

  @OneToMany(() => Contact, (contact) => contact.company, { cascade: true })
  contacts: Contact[];

  @OneToMany(() => Tag, (tag) => tag.company, { cascade: true })
  tags: Tag[];

  @OneToMany(() => Template, (template) => template.company, { cascade: true })
  templates: Template[];

  @OneToMany(() => ScheduledNotification, (sched) => sched.company, { cascade: true })
  scheduled_notifications: ScheduledNotification[];

  @OneToMany(() => NotificationLog, (log) => log.company, { cascade: true })
  notification_logs: NotificationLog[];

  @OneToMany(() => CompanyProviderConfig, (config) => config.company, { cascade: true })
  provider_configs: CompanyProviderConfig[];
}