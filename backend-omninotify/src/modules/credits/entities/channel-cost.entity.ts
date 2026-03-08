// src/modules/credits/entities/channel-cost.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum Channel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP'
}

@Entity('Channel_Costs')
export class ChannelCost {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: Channel,
    unique: true,
    comment: 'Canal de comunicación: EMAIL, SMS, WHATSAPP'
  })
  channel: Channel;

  @Column({ name: 'cost_per_message', default: 1, comment: 'Créditos que cuesta cada mensaje' })
  costPerMessage: number;

  @Column({ nullable: true, comment: 'Descripción o nota sobre el costo' })
  description: string;

  @UpdateDateColumn({ name: 'updated_at', comment: 'Última actualización' })
  updatedAt: Date;

  @Column({ name: 'updated_by', length: 100, nullable: true, comment: 'Usuario que hizo el cambio' })
  updatedBy: string;
}