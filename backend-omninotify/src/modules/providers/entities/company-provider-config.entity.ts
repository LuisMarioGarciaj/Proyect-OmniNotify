// src/modules/providers/entities/company-provider-config.entity.ts
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Provider } from './provider.entity';

// src/modules/providers/entities/company-provider-config.entity.ts
@Entity('Company_Providers_Config') 
export class CompanyProviderConfig {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  // Mapeamos el nombre de la columna de la DB al nombre de la propiedad en TS
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId: string; // En el código usaremos companyId

  @Column({ name: 'provider_id', type: 'int' })
  providerId: number;

  @Column({ type: 'json' }) 
  config: { 
    token?: string; 
    apiKey?: string; 
    apiSecret?: string;
    [key: string]: any 
  };

  @ManyToOne(() => Provider, (provider) => provider.company_configs)
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;
}