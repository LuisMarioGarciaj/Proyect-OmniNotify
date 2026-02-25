// src/modules/system/entities/system-config.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('System_Config')
export class SystemConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  config_key: string;

  @Column({ type: 'json' })
  config_value: Record<string, any>;

  @Column({ length: 50, default: 'general' })
  category: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}