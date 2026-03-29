// src/modules/auth/entities/reset-token.entity.ts
import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('reset_password_tokens')
export class ResetPasswordToken {
  @PrimaryColumn('char', { length: 36 })
  id: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  token: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Método para generar ID automáticamente
  constructor() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}