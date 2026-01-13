import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, ManyToMany } from 'typeorm';
// import { Company } from '../../companies/entities/company.entity';
import { Contact } from '../../contacts/entities/contact.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  // Relación con Company
  // @ManyToOne(() => Company, (company) => company.tags)
  // @JoinColumn({ name: 'company_id' })
  // company: Company;

  // Relación many-to-many con Contacts (inversa)
  @ManyToMany(() => Contact, (contact) => contact.tags)
  contacts: Contact[];
}