// src/modules/tags/entities/tag.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToMany } from 'typeorm';
import { Contact } from '../../contacts/entities/contact.entity';

@Entity('Tag')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'varchar', length: 36 })
  company_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ManyToMany(() => Contact, contact => contact.tags)
  contacts: Contact[];
}