// src/modules/credits/entities/credit-transaction.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { CreditRecharge } from './credit-recharge.entity';

export enum TransactionType {
  PURCHASE = 'PURCHASE',   // Compra de créditos (recarga)
  DEDUCTION = 'DEDUCTION', // Gasto de créditos (envío)
  REFUND = 'REFUND',       // Devolución de créditos
  BONUS = 'BONUS',         // Créditos bonus (promociones)
  ADJUSTMENT = 'ADJUSTMENT' // Ajuste manual por administrador
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP'
}

@Entity('Credit_Transactions')
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  @Index('idx_company_created')
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({
    type: 'enum',
    enum: TransactionType,
    nullable: true,
    comment: 'Tipo de transacción: PURCHASE=compra, DEDUCTION=gasto, REFUND=devolución, BONUS=bonus, ADJUSTMENT=ajuste'
  })
  type: TransactionType;

  @Column({ comment: 'Cantidad de créditos (positivo para compras, negativo para gastos)' })
  amount: number;

  @Column({ name: 'balance_before', comment: 'Saldo antes de la transacción' })
  balanceBefore: number;

  @Column({ name: 'balance_after', comment: 'Saldo después de la transacción' })
  balanceAfter: number;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    nullable: true,
    comment: 'Canal usado (solo para DEDUCTION)'
  })
  channel: NotificationChannel;

  @Column({ name: 'reference_id', length: 36, nullable: true, comment: 'ID de referencia (notification_id para DEDUCTION)' })
  referenceId: string;

  @Column({ name: 'recharge_id', length: 36, nullable: true, comment: 'ID de la recarga asociada (solo para PURCHASE)' })
  @Index('idx_recharge')
  rechargeId: string;

  @ManyToOne(() => CreditRecharge)
  @JoinColumn({ name: 'recharge_id' })
  recharge: CreditRecharge;

  @Column({ length: 255, comment: 'Descripción de la transacción' })
  description: string;

  @Column({ type: 'json', nullable: true, comment: 'Metadatos adicionales (respuesta de proveedores, etc)' })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  @Index('idx_company_created')
  createdAt: Date;
}