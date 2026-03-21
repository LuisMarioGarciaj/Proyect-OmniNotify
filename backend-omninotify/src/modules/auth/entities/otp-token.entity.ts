import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('otp_tokens')
export class OtpToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column({ length: 6 })
  code: string;

  @Column()
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;
}