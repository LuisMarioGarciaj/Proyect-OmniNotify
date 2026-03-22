// src/modules/users/entities/user.entity.ts
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('User')
export class User {
  @PrimaryColumn('char', { length: 36 })
  id: string;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  company_id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 150 })
  email: string;

  @Column({ length: 255 })
  password: string;

  @Column({
    type: 'enum',
    enum: ['ADMIN', 'OPERATOR'],
  })
  role: string;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'DISABLED'],
    default: 'ACTIVE',
  })
  status: string;

  company: any;

  @Column({
    name: 'is_first_login',
    type: 'tinyint',
    default: true,
  })
  is_first_login: boolean;
}