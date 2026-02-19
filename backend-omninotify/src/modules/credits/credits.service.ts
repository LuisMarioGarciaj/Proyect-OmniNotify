// src/modules/credits/credits.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  CreditTransaction,
  CreditTransactionType,
  NotificationChannel,
} from './entities/credit-transaction.entity';
import { Company } from '../companies/entities/company.entity';
import { PurchaseCreditsDto } from './dto/purchase-credits.dto';
import {
  CreditBalanceResponseDto,
  CreditTransactionResponseDto,
  CreditHistoryResponseDto,
  PurchaseCreditsResponseDto,
} from './dto/credit-response.dto';

export const CHANNEL_COSTS = {
  EMAIL: 1,
  SMS: 2,
  WHATSAPP: 1,
};

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    @InjectRepository(CreditTransaction)
    private creditTransactionRepo: Repository<CreditTransaction>,

    @InjectRepository(Company)
    private companyRepo: Repository<Company>,

    private dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSULTAS
  // ═══════════════════════════════════════════════════════════════════════════

  async getBalance(companyId: string): Promise<CreditBalanceResponseDto> {
    const company = await this.companyRepo.findOne({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return {
      currentBalance: company.current_credits || 0,
      companyId: company.id,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getHistory(
    companyId: string,
    page = 1,
    perPage = 20,
  ): Promise<CreditHistoryResponseDto> {
    const [transactions, total] = await this.creditTransactionRepo.findAndCount({
      where: { companyId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const balance = await this.getBalance(companyId);

    return {
      transactions: transactions.map(this.mapToDto),
      total,
      page,
      perPage,
      currentBalance: balance.currentBalance,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPRA REAL DE CRÉDITOS
  // ═══════════════════════════════════════════════════════════════════════════

  async purchaseCredits(
    companyId: string,
    dto: PurchaseCreditsDto,
  ): Promise<PurchaseCreditsResponseDto> {
    this.logger.log(`💳 Comprando ${dto.amount} créditos para empresa ${companyId}`);

    const transaction = await this.dataSource.transaction(async (manager) => {
      const company = await manager.findOne(Company, {
        where: { id: companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!company) throw new NotFoundException('Empresa no encontrada');

      const balanceBefore = company.current_credits || 0;
      const balanceAfter = balanceBefore + dto.amount;

      const creditTransaction = manager.create(CreditTransaction, {
        companyId,
        type: CreditTransactionType.PURCHASE,
        amount: dto.amount,
        balanceBefore,
        balanceAfter,
        description: `Compra de ${dto.amount} créditos vía ${dto.paymentMethod}`,
        metadata: {
          paymentMethod: dto.paymentMethod,
          paymentId: dto.paymentId,
          ...dto.metadata,
        },
      });

      await manager.save(creditTransaction);
      company.current_credits = balanceAfter;
      await manager.save(company);

      return creditTransaction;
    });

    this.logger.log(`✅ Compra exitosa: +${dto.amount} créditos (nuevo balance: ${transaction.balanceAfter})`);

    return {
      success: true,
      message: 'Créditos comprados exitosamente',
      transaction: this.mapToDto(transaction),
      newBalance: transaction.balanceAfter,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🧪 SIMULACIONES (solo para testing)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Simular compra de créditos sin pago real
   * Body: { "amount": 1000 }
   */
  async simulatePurchase(
    companyId: string,
    amount: number,
  ): Promise<PurchaseCreditsResponseDto> {
    this.logger.log(`🧪 [SIMULACIÓN] Agregando ${amount} créditos a empresa ${companyId}`);

    const transaction = await this.dataSource.transaction(async (manager) => {
      const company = await manager.findOne(Company, {
        where: { id: companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!company) throw new NotFoundException('Empresa no encontrada');

      const balanceBefore = company.current_credits || 0;
      const balanceAfter = balanceBefore + amount;

      const creditTransaction = manager.create(CreditTransaction, {
        companyId,
        type: CreditTransactionType.PURCHASE,
        amount,
        balanceBefore,
        balanceAfter,
        description: `Compra de ${amount} créditos vía SIMULATION`,
        metadata: {
          paymentMethod: 'SIMULATION',
          paymentId: `SIM-${Date.now()}`,
        },
      });

      await manager.save(creditTransaction);
      company.current_credits = balanceAfter;
      await manager.save(company);

      return creditTransaction;
    });

    this.logger.log(`✅ Simulación exitosa: +${amount} créditos (nuevo balance: ${transaction.balanceAfter})`);

    return {
      success: true,
      message: 'Créditos comprados exitosamente',
      transaction: this.mapToDto(transaction),
      newBalance: transaction.balanceAfter,
    };
  }

  /**
   * Simular descuento de créditos sin enviar notificación real
   * Body: { "channel": "WHATSAPP", "recipient": "+591..." }
   */
  async simulateDeduction(
    companyId: string,
    channel: NotificationChannel,
    recipient: string,
  ) {
    const cost = CHANNEL_COSTS[channel];
    this.logger.log(`🧪 [SIMULACIÓN] Descontando ${cost} créditos (${channel}) a empresa ${companyId}`);

    const transaction = await this.dataSource.transaction(async (manager) => {
      const company = await manager.findOne(Company, {
        where: { id: companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!company) throw new NotFoundException('Empresa no encontrada');

      const balanceBefore = company.current_credits || 0;

      if (balanceBefore < cost) {
        throw new BadRequestException(
          `Créditos insuficientes. Balance actual: ${balanceBefore}, requeridos: ${cost}`,
        );
      }

      const balanceAfter = balanceBefore - cost;

      const creditTransaction = manager.create(CreditTransaction, {
        companyId,
        type: CreditTransactionType.DEDUCTION,
        amount: -cost,
        balanceBefore,
        balanceAfter,
        channel,
        description: `Envío de ${channel} a ${recipient}`,
        metadata: { recipient, cost, simulated: true },
      });

      await manager.save(creditTransaction);
      company.current_credits = balanceAfter;
      await manager.save(company);

      return creditTransaction;
    });

    this.logger.log(`✅ Simulación de descuento: -${cost} créditos (nuevo balance: ${transaction.balanceAfter})`);

    return {
      success: true,
      message: 'Créditos descontados exitosamente (simulación)',
      transaction: this.mapToDto(transaction),
      newBalance: transaction.balanceAfter,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DESCUENTO REAL (llamado por el processor al enviar notificaciones)
  // ═══════════════════════════════════════════════════════════════════════════

  async deductCredits(
    companyId: string,
    channel: NotificationChannel,
    recipient: string,
    notificationLogId?: string,
  ): Promise<CreditTransaction> {
    const cost = CHANNEL_COSTS[channel];
    this.logger.log(`💸 Descontando ${cost} créditos (${channel}) para empresa ${companyId}`);

    const transaction = await this.dataSource.transaction(async (manager) => {
      const company = await manager.findOne(Company, {
        where: { id: companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!company) throw new NotFoundException('Empresa no encontrada');

      const balanceBefore = company.current_credits || 0;

      if (balanceBefore < cost) {
        throw new BadRequestException(
          `Créditos insuficientes. Balance actual: ${balanceBefore}, requeridos: ${cost}`,
        );
      }

      const balanceAfter = balanceBefore - cost;

      const creditTransaction = manager.create(CreditTransaction, {
        companyId,
        type: CreditTransactionType.DEDUCTION,
        amount: -cost,
        balanceBefore,
        balanceAfter,
        channel,
        referenceId: notificationLogId,
        description: `Envío de ${channel} a ${recipient}`,
        metadata: { recipient, cost },
      });

      await manager.save(creditTransaction);
      company.current_credits = balanceAfter;
      await manager.save(company);

      return creditTransaction;
    });

    this.logger.log(`✅ Créditos descontados: -${cost} (nuevo balance: ${transaction.balanceAfter})`);
    return transaction;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BONOS Y AJUSTES
  // ═══════════════════════════════════════════════════════════════════════════

  async grantBonus(
    companyId: string,
    amount: number,
    reason: string,
  ): Promise<CreditTransaction> {
    this.logger.log(`🎁 Otorgando ${amount} créditos de bono a empresa ${companyId}`);

    const transaction = await this.dataSource.transaction(async (manager) => {
      const company = await manager.findOne(Company, {
        where: { id: companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!company) throw new NotFoundException('Empresa no encontrada');

      const balanceBefore = company.current_credits || 0;
      const balanceAfter = balanceBefore + amount;

      const creditTransaction = manager.create(CreditTransaction, {
        companyId,
        type: CreditTransactionType.BONUS,
        amount,
        balanceBefore,
        balanceAfter,
        description: `Bono: ${reason}`,
        metadata: { reason },
      });

      await manager.save(creditTransaction);
      company.current_credits = balanceAfter;
      await manager.save(company);

      return creditTransaction;
    });

    this.logger.log(`✅ Bono otorgado: +${amount} créditos`);
    return transaction;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private mapToDto(transaction: CreditTransaction): CreditTransactionResponseDto {
    return {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      channel: transaction.channel,
      description: transaction.description,
      createdAt: transaction.createdAt.toISOString(),
      metadata: transaction.metadata,
    };
  }

  async hasEnoughCredits(
    companyId: string,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) return false;
    const cost = CHANNEL_COSTS[channel];
    return (company.current_credits || 0) >= cost;
  }
}