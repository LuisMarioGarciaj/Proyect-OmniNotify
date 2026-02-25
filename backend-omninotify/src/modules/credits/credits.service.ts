// src/modules/credits/credits.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreditTransaction, CreditTransactionType, NotificationChannel } from './entities/credit-transaction.entity';
import { Company } from '../companies/entities/company.entity';
import { PurchaseCreditsDto } from './dto/purchase-credits.dto';
import { SimulatePurchaseDto } from './dto/simulate-purchase.dto';
import { SimulateDeductionDto } from './dto/simulate-deduction.dto';
import { 
  CreditBalanceResponseDto,
  CreditHistoryResponseDto, 
  PurchaseCreditsResponseDto,
  CreditTransactionResponseDto 
} from './dto/credit-response.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { VerifyQrDto } from './dto/verify-qr.dto';
import { GenerateUrlDto } from './dto/generate-url.dto';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);
  
  // Costos por canal (constante compartida)
  private readonly CHANNEL_COSTS = {
    EMAIL: 1,
    SMS: 2,
    WHATSAPP: 1,
  };

  // Configuración de YOPAGO (del archivo de Postman)
  private readonly YOPAGO_CONFIG = {
    baseUrl: 'https://yopago.com.bo',
    companyCode: 'WU59-YZ4B-BCP2-M38Y', // Código de empresa en YOPAGO
    corsUrl: 'https://yopago.nexoss.pro/api/yopago-handle-generate-qr', // Para CORS
  };

  constructor(
    @InjectRepository(CreditTransaction)
    private creditTransactionRepository: Repository<CreditTransaction>,
    
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    
    private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
    
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Convierte una entidad CreditTransaction a CreditTransactionResponseDto
   */
  private toTransactionResponse(transaction: CreditTransaction): CreditTransactionResponseDto {
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

  /**
   * Obtiene el saldo actual de créditos de una empresa
   */
  async getBalance(companyId: string): Promise<CreditBalanceResponseDto> {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException(`Empresa con ID ${companyId} no encontrada`);
    }

    return {
      currentBalance: company.current_credits || 0,
      companyId,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Obtiene el saldo como número (para uso interno)
   */
  async getBalanceNumber(companyId: string): Promise<number> {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException(`Empresa con ID ${companyId} no encontrada`);
    }

    return company.current_credits || 0;
  }

  /**
   * Obtiene el historial de transacciones con paginación
   */
  async getHistory(
    companyId: string,
    page: number = 1,
    perPage: number = 20,
  ): Promise<CreditHistoryResponseDto> {
    const [transactions, total] = await this.creditTransactionRepository
      .createQueryBuilder('ct')
      .where('ct.companyId = :companyId', { companyId })
      .orderBy('ct.createdAt', 'DESC')
      .skip((page - 1) * perPage)
      .take(perPage)
      .getManyAndCount();

    const balance = await this.getBalance(companyId);

    const transactionDtos = transactions.map(tx => this.toTransactionResponse(tx));

    return {
      transactions: transactionDtos,
      total,
      page,
      perPage,
      currentBalance: balance.currentBalance,
    };
  }

  /**
   * Verifica si hay créditos suficientes para un canal
   */
  async hasEnoughCredits(companyId: string, channel: 'EMAIL' | 'SMS' | 'WHATSAPP'): Promise<boolean> {
    const requiredCredits = this.CHANNEL_COSTS[channel] || 1;
    const currentBalance = await this.getBalanceNumber(companyId);
    return currentBalance >= requiredCredits;
  }

  /**
   * Descuenta créditos de una empresa (usado por NotificationProcessor)
   */
  async deductCredits(
    companyId: string,
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP',
    recipient: string,
    referenceId?: string,
    queryRunner?: QueryRunner,
  ): Promise<PurchaseCreditsResponseDto> {
    const requiredCredits = this.CHANNEL_COSTS[channel] || 1;

    const useQueryRunner = queryRunner || this.dataSource.createQueryRunner();
    let shouldRelease = false;

    if (!queryRunner) {
      await useQueryRunner.connect();
      await useQueryRunner.startTransaction();
      shouldRelease = true;
    }

    try {
      const company = await useQueryRunner.manager
        .createQueryBuilder(Company, 'company')
        .setLock('pessimistic_write')
        .where('company.id = :id', { id: companyId })
        .getOne();

      if (!company) {
        throw new NotFoundException(`Empresa con ID ${companyId} no encontrada`);
      }

      const currentBalance = company.current_credits || 0;

      if (currentBalance < requiredCredits) {
        throw new BadRequestException(
          `Créditos insuficientes. Balance actual: ${currentBalance}, requeridos: ${requiredCredits}`,
        );
      }

      const newBalance = currentBalance - requiredCredits;

      await useQueryRunner.manager.update(
        Company,
        { id: companyId },
        { current_credits: newBalance },
      );

      const transaction = this.creditTransactionRepository.create({
        id: uuidv4(),
        companyId: companyId,
        type: CreditTransactionType.DEDUCTION,
        amount: -requiredCredits,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        channel: channel as NotificationChannel,
        referenceId: referenceId,
        description: `Envío de ${channel} a ${recipient}`,
        metadata: {
          recipient,
          channel,
          timestamp: new Date().toISOString(),
        },
      });

      const savedTransaction = await useQueryRunner.manager.save(transaction);

      if (!queryRunner && shouldRelease) {
        await useQueryRunner.commitTransaction();
      }

      return {
        success: true,
        message: `${requiredCredits} crédito(s) descontado(s) por envío de ${channel}`,
        transaction: this.toTransactionResponse(savedTransaction),
        newBalance,
      };
    } catch (error) {
      if (!queryRunner && shouldRelease) {
        await useQueryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (!queryRunner && shouldRelease) {
        await useQueryRunner.release();
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🪙 COMPRA DE CRÉDITOS CON QR (INTEGRACIÓN CON YOPAGO)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Genera un código QR para pago
   */
  async generateQr(
    companyId: string,
    qrDto: GenerateQrDto,
  ): Promise<any> {
    try {
      this.logger.log(`🪙 Generando QR para empresa ${companyId}, monto: ${qrDto.amount}`);

      const company = await this.companyRepository.findOne({
        where: { id: companyId },
      });

      if (!company) {
        throw new NotFoundException(`Empresa con ID ${companyId} no encontrada`);
      }

      // Preparar payload para YOPAGO
      const payload = {
        companyCode: this.YOPAGO_CONFIG.companyCode,
        codeTransaction: qrDto.codeTransaction || `TRX-${Date.now()}`,
        urlSuccess: qrDto.urlSuccess || 'https://omninotify.com/pago-exitoso',
        urlFailed: qrDto.urlFailed || 'https://omninotify.com/pago-fallido',
        billName: qrDto.billName || company.name,
        billNit: qrDto.billNit || '123456789',
        email: qrDto.email || 'cliente@ejemplo.com',
        generateBill: qrDto.generateBill || '1',
        concept: qrDto.concept || `Recarga de créditos - ${company.name}`,
        currency: qrDto.currency || 'BOB',
        amount: qrDto.amount.toString(),
        messagePayment: qrDto.messagePayment || 'Gracias por tu compra',
        codeExternal: qrDto.codeExternal || '',
      };

      // Llamar a la API de YOPAGO
      const response = await firstValueFrom(
        this.httpService.post(`${this.YOPAGO_CONFIG.baseUrl}/pay/qr/generateQr`, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`✅ QR generado exitosamente: ${JSON.stringify(response.data)}`);

      // Guardar metadata para verificación posterior
      return {
        success: true,
        qrData: response.data,
        companyId,
        amount: qrDto.amount,
        transactionCode: payload.codeTransaction,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
      };
    } catch (error) {
      this.logger.error(`❌ Error generando QR: ${error.message}`);
      throw new HttpException(
        `Error generando QR: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Genera URL de pago (alternativa al QR)
   */
  async generateUrl(
    companyId: string,
    urlDto: GenerateUrlDto,
  ): Promise<any> {
    try {
      this.logger.log(`🔗 Generando URL de pago para empresa ${companyId}, monto: ${urlDto.amount}`);

      const company = await this.companyRepository.findOne({
        where: { id: companyId },
      });

      if (!company) {
        throw new NotFoundException(`Empresa con ID ${companyId} no encontrada`);
      }

      const payload = {
        companyCode: this.YOPAGO_CONFIG.companyCode,
        codeTransaction: urlDto.codeTransaction || `URL-${Date.now()}`,
        urlSuccess: urlDto.urlSuccess || 'https://omninotify.com/pago-exitoso',
        urlFailed: urlDto.urlFailed || 'https://omninotify.com/pago-fallido',
        billName: urlDto.billName || company.name,
        billNit: urlDto.billNit || '123456789',
        email: urlDto.email || 'cliente@ejemplo.com',
        generateBill: urlDto.generateBill || '1',
        concept: urlDto.concept || `Recarga de créditos - ${company.name}`,
        currency: urlDto.currency || 'BOB',
        amount: urlDto.amount.toString(),
        messagePayment: urlDto.messagePayment || 'Gracias por tu compra',
        codeExternal: urlDto.codeExternal || '',
      };

      const response = await firstValueFrom(
        this.httpService.post(`${this.YOPAGO_CONFIG.baseUrl}/pay/api/generateUrl`, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`✅ URL generada exitosamente: ${response.data.paymentUrl}`);

      return {
        success: true,
        paymentUrl: response.data.paymentUrl,
        companyId,
        amount: urlDto.amount,
        transactionCode: payload.codeTransaction,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
      };
    } catch (error) {
      this.logger.error(`❌ Error generando URL: ${error.message}`);
      throw new HttpException(
        `Error generando URL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verifica el estado de un pago por QR
   */
  async verifyQr(
    companyId: string,
    verifyDto: VerifyQrDto,
  ): Promise<any> {
    try {
      this.logger.log(`🔍 Verificando pago QR: ${verifyDto.qrId}`);

      const payload = {
        companyCode: this.YOPAGO_CONFIG.companyCode,
        transactionId: verifyDto.transactionId,
        qrId: verifyDto.qrId,
      };

      const response = await firstValueFrom(
        this.httpService.post(`${this.YOPAGO_CONFIG.baseUrl}/pay/qr/verifyQr`, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`✅ Verificación completada: ${JSON.stringify(response.data)}`);

      // Si el pago fue exitoso, agregar créditos
      if (response.data.status === 'SUCCESS') {
        const amount = parseInt(response.data.amount) || 0;
        if (amount > 0) {
          const result = await this.purchaseCredits(companyId, {
            amount,
            paymentMethod: 'QR',
            paymentId: response.data.paymentId || verifyDto.transactionId,
            metadata: {
              qrId: verifyDto.qrId,
              transactionId: verifyDto.transactionId,
              provider: 'yopago',
              providerResponse: response.data,
            },
          });
          return {
            ...response.data,
            credits: result,
          };
        }
      }

      return {
        ...response.data,
        credits: null,
      };
    } catch (error) {
      this.logger.error(`❌ Error verificando QR: ${error.message}`);
      throw new HttpException(
        `Error verificando QR: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verifica una transacción por URL
   */
  async verifyTransaction(
    companyId: string,
    transactionId: string,
  ): Promise<any> {
    try {
      this.logger.log(`🔍 Verificando transacción: ${transactionId}`);

      const payload = {
        companyCode: this.YOPAGO_CONFIG.companyCode,
        transactionId,
      };

      const response = await firstValueFrom(
        this.httpService.post(`${this.YOPAGO_CONFIG.baseUrl}/pay/api/verifyTransfer`, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`✅ Transacción verificada: ${JSON.stringify(response.data)}`);

      if (response.data.status === 'SUCCESS') {
        const amount = parseInt(response.data.amount) || 0;
        if (amount > 0) {
          const result = await this.purchaseCredits(companyId, {
            amount,
            paymentMethod: 'TRANSFER',
            paymentId: response.data.paymentId || transactionId,
            metadata: {
              transactionId,
              provider: 'yopago',
              providerResponse: response.data,
            },
          });
          return {
            ...response.data,
            credits: result,
          };
        }
      }

      return {
        ...response.data,
        credits: null,
      };
    } catch (error) {
      this.logger.error(`❌ Error verificando transacción: ${error.message}`);
      throw new HttpException(
        `Error verificando transacción: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 💳 COMPRA DE CRÉDITOS (TRANSACCIONES REALES)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compra real de créditos (con validación de pago)
   */
  async purchaseCredits(
    companyId: string,
    purchaseDto: PurchaseCreditsDto,
  ): Promise<PurchaseCreditsResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const company = await queryRunner.manager
        .createQueryBuilder(Company, 'company')
        .setLock('pessimistic_write')
        .where('company.id = :id', { id: companyId })
        .getOne();

      if (!company) {
        throw new NotFoundException(`Empresa con ID ${companyId} no encontrada`);
      }

      const currentBalance = company.current_credits || 0;
      const newBalance = currentBalance + purchaseDto.amount;

      await queryRunner.manager.update(
        Company,
        { id: companyId },
        { current_credits: newBalance },
      );

      const transaction = this.creditTransactionRepository.create({
        id: uuidv4(),
        companyId: companyId,
        type: CreditTransactionType.PURCHASE,
        amount: purchaseDto.amount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: `Compra de ${purchaseDto.amount} créditos vía ${purchaseDto.paymentMethod}`,
        metadata: {
          paymentMethod: purchaseDto.paymentMethod,
          paymentId: purchaseDto.paymentId,
          ...purchaseDto.metadata,
        },
      });

      const savedTransaction = await queryRunner.manager.save(transaction);
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Créditos comprados exitosamente',
        transaction: this.toTransactionResponse(savedTransaction),
        newBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Simula una compra de créditos (solo para testing)
   */
  async simulatePurchase(
    companyId: string,
    simulateDto: SimulatePurchaseDto,
  ): Promise<PurchaseCreditsResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const company = await queryRunner.manager
        .createQueryBuilder(Company, 'company')
        .setLock('pessimistic_write')
        .where('company.id = :id', { id: companyId })
        .getOne();

      if (!company) {
        throw new NotFoundException(`Empresa con ID ${companyId} no encontrada`);
      }

      const currentBalance = company.current_credits || 0;
      const newBalance = currentBalance + simulateDto.amount;

      await queryRunner.manager.update(
        Company,
        { id: companyId },
        { current_credits: newBalance },
      );

      const transaction = this.creditTransactionRepository.create({
        id: uuidv4(),
        companyId: companyId,
        type: CreditTransactionType.PURCHASE,
        amount: simulateDto.amount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: `Compra de ${simulateDto.amount} créditos vía SIMULATION`,
        metadata: {
          paymentMethod: 'SIMULATION',
          paymentId: `SIM-${Date.now()}`,
          simulation: true,
        },
      });

      const savedTransaction = await queryRunner.manager.save(transaction);
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Simulación de compra exitosa',
        transaction: this.toTransactionResponse(savedTransaction),
        newBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Simula un descuento de créditos (solo para testing)
   */
  async simulateDeduction(
    companyId: string,
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP',
    recipient: string,
  ): Promise<PurchaseCreditsResponseDto> {
    return this.deductCredits(companyId, channel, recipient);
  }

  /**
   * Otorga créditos como bono (solo administradores)
   */
  async grantBonus(
    companyId: string,
    amount: number,
    reason: string,
    adminId?: string,
  ): Promise<PurchaseCreditsResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const company = await queryRunner.manager
        .createQueryBuilder(Company, 'company')
        .setLock('pessimistic_write')
        .where('company.id = :id', { id: companyId })
        .getOne();

      if (!company) {
        throw new NotFoundException(`Empresa con ID ${companyId} no encontrada`);
      }

      const currentBalance = company.current_credits || 0;
      const newBalance = currentBalance + amount;

      await queryRunner.manager.update(
        Company,
        { id: companyId },
        { current_credits: newBalance },
      );

      const transaction = this.creditTransactionRepository.create({
        id: uuidv4(),
        companyId: companyId,
        type: CreditTransactionType.BONUS,
        amount: amount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: reason,
        metadata: {
          grantedBy: adminId,
          reason,
        },
      });

      const savedTransaction = await queryRunner.manager.save(transaction);
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `Bono de ${amount} créditos otorgado exitosamente`,
        transaction: this.toTransactionResponse(savedTransaction),
        newBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}