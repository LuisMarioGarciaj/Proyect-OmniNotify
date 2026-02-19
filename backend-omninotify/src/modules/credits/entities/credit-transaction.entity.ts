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
  PURCHASE = 'PURCHASE',     // Compra de créditos (QR, tarjeta, etc)
  DEDUCTION = 'DEDUCTION',   // Descuento por envío
  REFUND = 'REFUND',         // Devolución
  BONUS = 'BONUS',           // Créditos gratis (promoción, bono)
  ADJUSTMENT = 'ADJUSTMENT', // Ajuste manual (admin)
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

/**
 * Registro de TODAS las transacciones de créditos
 * 
 * Esta tabla funciona como un ledger (libro contable) donde:
 * - Cada transacción tiene un balance_before y balance_after
 * - Se puede reconstruir el historial completo
 * - Se puede auditar cualquier inconsistencia
 * 
 * Ejemplo de flujo:
 * 1. Empresa compra 1000 créditos → type: PURCHASE, amount: 1000
 * 2. Envía WhatsApp → type: DEDUCTION, amount: -1, channel: WHATSAPP
 * 3. Envía SMS → type: DEDUCTION, amount: -2, channel: SMS
 */
@Entity('Credit_Transactions')
@Index(['companyId', 'createdAt']) // Para queries rápidas por empresa
@Index(['type', 'createdAt'])      // Para reportes por tipo
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── Relación con empresa ────────────────────────────────────────────────
  @Column({ type: 'char', length: 36, name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  // ─── Tipo de transacción ─────────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: CreditTransactionType,
  })
  type: CreditTransactionType;

  // ─── Monto ────────────────────────────────────────────────────────────────
  // Positivo = carga/bono, Negativo = gasto
  @Column({ type: 'int' })
  amount: number;

  // ─── Balance antes y después ─────────────────────────────────────────────
  // Esto permite auditar y reconstruir el historial
  @Column({ type: 'int', name: 'balance_before' })
  balanceBefore: number;

  @Column({ type: 'int', name: 'balance_after' })
  balanceAfter: number;

  // ─── Canal (solo para DEDUCTION) ─────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: NotificationChannel,
    nullable: true,
  })
  channel?: NotificationChannel;

  // ─── Referencia al log de notificación ───────────────────────────────────
  // Si type = DEDUCTION, este campo apunta al NOTIFICATION_LOG
  @Column({ type: 'char', length: 36, nullable: true, name: 'reference_id' })
  referenceId?: string;

  // ─── Descripción legible ─────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 255 })
  description: string;

  // ─── Metadata adicional ──────────────────────────────────────────────────
  // Para PURCHASE: método de pago, ID de transacción de QR
  // Para DEDUCTION: recipient, template usado
  @Column({ type: 'json', nullable: true })
  metadata?: {
    paymentMethod?: string;
    paymentId?: string;
    qrCode?: string;
    recipient?: string;
    templateId?: string;
    [key: string]: any;
  };

  // ─── Timestamp ───────────────────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}