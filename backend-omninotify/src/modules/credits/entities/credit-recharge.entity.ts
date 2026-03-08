import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';

export enum PayMethod {
  CARD = 'CARD',
  QR = 'QR',
  STRIKE = 'STRIKE'
}

export enum QrStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED'
}

@Entity('Credit_Recharge')
export class CreditRecharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  @Index('idx_company_recharge')
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({
    type: 'enum',
    enum: PayMethod,
    comment: 'CARD=tarjeta (genera URL), QR=código QR, STRIKE=transferencia'
  })
  paymethod: PayMethod;

  @Column({ name: 'transaction_id', length: 100, unique: true })
  @Index('idx_transaction')
  transactionId: string;

  @Column({ name: 'qr_id', length: 100, nullable: true })
  @Index('idx_qr_id')
  qrId: string;

  @Column({ name: 'company_code', length: 50 })
  companyCode: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column()
  credits: number;

  @Column({
    name: 'qr_status',
    type: 'enum',
    enum: QrStatus,
    default: QrStatus.PENDING,
    comment: 'Estado del QR físico: PENDING=generado, PAID=escaneado, EXPIRED=vencido, CANCELLED=cancelado'
  })
  @Index('idx_qr_status')
  qrStatus: QrStatus;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    comment: 'Estado del pago: PENDING=pendiente, PAID=pagado, EXPIRED=vencido, FAILED=falló'
  })
  @Index('idx_payment_status')
  paymentStatus: PaymentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'paid_at', nullable: true })
  paidAt: Date;

  @Column({ name: 'expires_at', nullable: true })
  @Index('idx_expires')
  expiresAt: Date;

  
}