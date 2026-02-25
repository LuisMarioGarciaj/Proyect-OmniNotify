// src/modules/credits/entities/credit-transaction.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';

export enum CreditTransactionType {
  PURCHASE = 'PURCHASE',
  DEDUCTION = 'DEDUCTION',
  REFUND = 'REFUND',
  BONUS = 'BONUS',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

@Entity('Credit_Transactions')
@Index(['companyId', 'createdAt'])
@Index(['type', 'createdAt'])
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // IMPORTANTE: Usar camelCase para las propiedades de TypeORM
  @Column({ type: 'char', length: 36, name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({
    type: 'enum',
    enum: CreditTransactionType,
  })
  type: CreditTransactionType;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'int', name: 'balance_before' })
  balanceBefore: number;

  @Column({ type: 'int', name: 'balance_after' })
  balanceAfter: number;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    nullable: true,
  })
  channel?: NotificationChannel;

  @Column({ type: 'char', length: 36, nullable: true, name: 'reference_id' })
  referenceId?: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}