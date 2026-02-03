// src/modules/users/entities/user.entity.ts
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('User')  
export class User {
  @PrimaryColumn('char', { length: 36 })
  id: string;  // ← char(36) es string

  @Column({ name: 'company_id', type: 'char', length: 36 })
  company_id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 150 })
  email: string;

  @Column({ length: 255 })  // ← Se llama 'password' en la BD
  password: string;  // ← Cambiado de 'password_hash' a 'password'

  @Column({ 
    type: 'enum',
    enum: ['ADMIN', 'OPERATOR']
  })
  role: string;  // ← Se llama 'role' no 'user_role'

  @Column({ 
    type: 'enum',
    enum: ['ACTIVE', 'DISABLED'],
    default: 'ACTIVE'
  })
  status: string;
}