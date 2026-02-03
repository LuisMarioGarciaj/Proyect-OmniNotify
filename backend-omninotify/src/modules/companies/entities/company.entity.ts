// src/modules/companies/entities/company.entity.ts
import { Entity, PrimaryColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { CompanyProviderConfig } from '../../providers/entities/company-provider-config.entity';

export enum CompanyStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

@Entity('Company') // Nombre exacto en MySQL
export class Company {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 150, nullable: false })
  name: string;

  @Column({
    type: 'enum',
    enum: CompanyStatus,
    default: CompanyStatus.ACTIVE,
  })
  status: CompanyStatus;

  @Column({ type: 'longtext', nullable: true })
  logo: string | null; // Guardará el base64

  // Este campo lo tienes en el ERD original, es útil para configuraciones globales
  @Column({ type: 'json', nullable: true })
  api_keys_config: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relación con las configuraciones de proveedores (Nexo, Vonage, etc)
  @OneToMany(() => CompanyProviderConfig, (config) => config.companyId)
  providerConfigs: CompanyProviderConfig[];
}