import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
// import { Company } from '../../companies/entities/company.entity';
import { Tag } from '../../tags/entities/tag.entity';

@Entity('Contact')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string;

  // Formato E.164: +1234567890
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  // Metadatos: tags, segmentos, etc.
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  // Relaciones
  // @ManyToOne(() => Company, (company) => company.contacts)
  // @JoinColumn({ name: 'company_id' })
  // company: Company;

  // Relación many-to-many con Tags
  @ManyToMany(() => Tag, (tag) => tag.contacts)
  @JoinTable({
    name: 'Contact_Tags',
    joinColumn: { name: 'contact_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];
}