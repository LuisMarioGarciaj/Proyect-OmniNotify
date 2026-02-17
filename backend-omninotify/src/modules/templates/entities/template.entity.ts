import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

@Entity('Template')
@Index(['company_id', 'alias', 'channel'])
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'varchar', length: 36 })
  company_id: string;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.EMAIL,
  })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  @Index() // Índice simple para búsquedas
  alias: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'provider_template_id', type: 'varchar', length: 150, nullable: true })
  provider_template_id: string;
  
  // NOTA: No hay created_at en la tabla según el dump de MySQL
  // Si necesitas agregarlo, tendrías que modificar la tabla:
  // ALTER TABLE Template ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
}