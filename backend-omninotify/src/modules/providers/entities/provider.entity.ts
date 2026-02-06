import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { NotificationChannel } from '../../templates/entities/template.entity';
import { CompanyProviderConfig } from './company-provider-config.entity';

@Entity('Provider')
export class Provider {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string; // "SendGrid", "Twilio", "Meta", etc.

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  // Relación
  @OneToMany(() => CompanyProviderConfig, (config) => config.provider)
  company_configs: CompanyProviderConfig[];
}