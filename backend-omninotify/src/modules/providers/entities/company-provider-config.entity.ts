import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { Provider } from './provider.entity';

@Entity('company_provider_configs')
export class CompanyProviderConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'int' })
  provider_id: number;

  // JSON con la configuración específica (API keys, tokens, etc.)
  @Column({ type: 'jsonb' })
  config: Record<string, any>;

  // Relaciones
  @ManyToOne(() => Company, (company) => company.provider_configs)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Provider, (provider) => provider.company_configs)
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;
}