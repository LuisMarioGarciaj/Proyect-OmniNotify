import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Company } from '../companies/entities/company.entity';
import { CreditTransaction, TransactionType, NotificationChannel } from './entities/credit-transaction.entity';
import { CreditRecharge, PayMethod, QrStatus, PaymentStatus } from './entities/credit-recharge.entity';
import { ChannelCost, Channel } from './entities/channel-cost.entity';
import { PurchaseCreditsDto, PurchaseMethod } from './dto/purchase-credits.dto';
import { VerifyQrDto } from './dto/verify-qr.dto';
import { VerifyTransactionDto } from './dto/verify-transaction.dto';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);
  private readonly yopagoApiUrl: string;
  private readonly successUrl: string;
  private readonly failedUrl: string;

  // Mapeo de códigos de empresa según el ID de compañía
  private readonly companyCodeMap: Record<string, string> = {
    '25a63d10-eff4-11f0-86e6-a2aaf909b30d': 'WU59-YZ4B-BCP2-M38Y',
    'ad8492bf-f367-11f0-86e6-a2aaf909b30d': 'ZZRR-NX33-53RE-FLY2',
  };

  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(CreditTransaction)
    private transactionRepository: Repository<CreditTransaction>,
    @InjectRepository(CreditRecharge)
    private rechargeRepository: Repository<CreditRecharge>,
    @InjectRepository(ChannelCost)
    private channelCostRepository: Repository<ChannelCost>,
    private httpService: HttpService,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {
    this.yopagoApiUrl = this.configService.get('YOPAGO_API_URL', 'https://yopago.com.bo');
    this.successUrl = this.configService.get('YOPAGO_SUCCESS_URL', 'https://exito.com.bo');
    this.failedUrl = this.configService.get('YOPAGO_FAILED_URL', 'https://falla.com.bo');
  }

  /**
   * Obtener el código de empresa de Yopago para una compañía
   */
  private getCompanyCode(companyId: string): string {
    console.log('🔍 getCompanyCode - companyId recibido:', companyId);
    
    if (!companyId) {
      this.logger.error('❌ companyId es undefined en getCompanyCode');
      return 'WU59-YZ4B-BCP2-M38Y'; // Código por defecto
    }
    
    if (companyId === 'undefined' || companyId === 'null') {
      this.logger.error(`❌ companyId es el string "${companyId}" en getCompanyCode`);
      return 'WU59-YZ4B-BCP2-M38Y'; // Código por defecto
    }
    
    const code = this.companyCodeMap[companyId];
    if (!code) {
      this.logger.warn(`No se encontró código de empresa para companyId: ${companyId}, usando código por defecto`);
      return 'WU59-YZ4B-BCP2-M38Y'; // Código por defecto
    }
    return code;
  }

  /**
   * Calcular créditos basado en el monto (1 Bs = 1 crédito)
   */
  private calculateCredits(amount: number): number {
    return Math.floor(amount);
  }

  /**
   * Generar un nuevo código de transacción único
   */
  private generateTransactionCode(): string {
    return Math.floor(Math.random() * 1000000).toString();
  }

  /**
   * Obtener saldo actual de una empresa
   */
  async getBalance(companyId: string): Promise<{ credits: number; companyName: string }> {
    console.log('💰 CreditsService.getBalance - companyId:', companyId);
    
    const company = await this.companyRepository.findOne({ 
      where: { id: companyId } 
    });
    
    if (!company) {
      console.error('❌ Empresa no encontrada:', companyId);
      throw new NotFoundException('Empresa no encontrada');
    }

    console.log('✅ Empresa encontrada:', {
      id: company.id,
      name: company.name,
      current_credits: company.current_credits
    });

    const result = {
      credits: company.current_credits || 0,
      companyName: company.name || 'Mi Empresa',
    };
    
    console.log('📡 Enviando respuesta:', result);
    return result;
  }

  /**
   * Crear una recarga (QR o URL de pago)
   */
  async createRecharge(companyId: string, purchaseDto: PurchaseCreditsDto): Promise<any> {
    console.log('💰 CreditsService.createRecharge - companyId:', companyId);
    console.log('📦 purchaseDto:', purchaseDto);
    
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      console.error('❌ Empresa no encontrada:', companyId);
      throw new NotFoundException('Empresa no encontrada');
    }

    const companyCode = this.getCompanyCode(companyId);
    const codeTransaction = this.generateTransactionCode();
    const credits = purchaseDto.credits || this.calculateCredits(purchaseDto.amount);

    // Crear registro de recarga
    const recharge = new CreditRecharge();
    recharge.id = uuidv4();
    recharge.companyId = companyId;
    recharge.paymethod = purchaseDto.method as unknown as PayMethod;
    recharge.transactionId = codeTransaction;
    recharge.companyCode = companyCode;
    recharge.amount = purchaseDto.amount;
    recharge.credits = credits;
    recharge.qrStatus = QrStatus.PENDING;
    recharge.paymentStatus = PaymentStatus.PENDING;
    
    // Fecha de expiración: 1 día después
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);
    recharge.expiresAt = expiresAt;

    let yopagoResponse: any;

    try {
      if (purchaseDto.method === PurchaseMethod.QR) {
        // Generar QR con Yopago
        const qrRequest = {
          companyCode,
          codeTransaction,
          urlSuccess: this.successUrl,
          urlFailed: this.failedUrl,
          billName: purchaseDto.billName || company.name,
          billNit: purchaseDto.billNit || '0',
          email: purchaseDto.email || 'cliente@example.com',
          generateBill: purchaseDto.billNit ? '1' : '0',
          concept: purchaseDto.concept || 'Recarga de créditos',
          currency: 'BOB' as const,
          amount: purchaseDto.amount.toString(),
          messagePayment: 'Gracias por tu compra',
          codeExternal: '',
        };

        console.log('📤 Enviando solicitud a Yopago (QR):', qrRequest);

        const response = await firstValueFrom(
          this.httpService.post(
            `${this.yopagoApiUrl}/pay/qr/generateQr`,
            qrRequest
          )
        );

        console.log('📥 Respuesta de Yopago:', response.data);

        // Yopago devuelve status: 0 para éxito
        if (response.data.status !== 0) {
          throw new BadRequestException(response.data.message || 'Error al generar QR');
        }

        yopagoResponse = response.data;
        recharge.transactionId = yopagoResponse.transactionId;
        recharge.qrId = yopagoResponse.qrId;
        
        console.log('✅ QR generado exitosamente:', { 
          transactionId: yopagoResponse.transactionId, 
          qrId: yopagoResponse.qrId 
        });
        
      } else if (purchaseDto.method === PurchaseMethod.CARD) {
        // Generar URL de pago con tarjeta
        const urlRequest = {
          companyCode,
          codeTransaction,
          urlSuccess: this.successUrl,
          urlFailed: this.failedUrl,
          billName: purchaseDto.billName || company.name,
          billNit: purchaseDto.billNit || '0',
          email: purchaseDto.email || 'cliente@example.com',
          generateBill: purchaseDto.billNit ? '1' : '0',
          concept: purchaseDto.concept || 'Recarga de créditos',
          currency: 'BOB' as const,
          amount: purchaseDto.amount.toString(),
          messagePayment: 'Gracias por tu compra',
          codeExternal: '',
        };

        console.log('📤 Enviando solicitud a Yopago (URL):', urlRequest);

        const response = await firstValueFrom(
          this.httpService.post(
            `${this.yopagoApiUrl}/pay/api/generateUrl`,
            urlRequest
          )
        );

        console.log('📥 Respuesta de Yopago:', response.data);

        // Yopago devuelve status: 0 para éxito
        if (response.data.status !== 0) {
          throw new BadRequestException(response.data.message || 'Error al generar URL de pago');
        }

        yopagoResponse = response.data;
        recharge.transactionId = yopagoResponse.transactionId;
      } else {
        throw new BadRequestException('Método de pago no soportado');
      }

      // Guardar la recarga
      await this.rechargeRepository.save(recharge);

      // Devolver respuesta según método
      if (purchaseDto.method === PurchaseMethod.QR) {
        return {
          id: recharge.id,
          transactionId: recharge.transactionId,
          qrId: recharge.qrId,
          qrCode: yopagoResponse?.qr,
          amount: recharge.amount,
          credits: recharge.credits,
          expiresAt: recharge.expiresAt,
          qrStatus: recharge.qrStatus,
          paymentStatus: recharge.paymentStatus,
        };
      } else {
        return {
          id: recharge.id,
          transactionId: recharge.transactionId,
          paymentUrl: yopagoResponse?.paymentUrl,
          amount: recharge.amount,
          credits: recharge.credits,
          expiresAt: recharge.expiresAt,
          paymentStatus: recharge.paymentStatus,
        };
      }
    } catch (error) {
      console.error('❌ Error al crear recarga:', error);
      throw new InternalServerErrorException('Error al procesar la solicitud de pago');
    }
  }

  /**
   * Verificar el estado de una recarga (QR)
   */
  async verifyQrRecharge(companyId: string, verifyDto: VerifyQrDto): Promise<any> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Buscar la recarga
    const recharge = await this.rechargeRepository.findOne({
      where: {
        transactionId: verifyDto.transactionId,
        companyId: companyId,
        paymethod: PayMethod.QR,
      },
    });

    if (!recharge) {
      throw new NotFoundException('Recarga no encontrada');
    }

    // Si ya está pagada, no volver a verificar
    if (recharge.paymentStatus === PaymentStatus.PAID) {
      return {
        id: recharge.id,
        transactionId: recharge.transactionId,
        qrId: recharge.qrId,
        qrStatus: recharge.qrStatus,
        paymentStatus: recharge.paymentStatus,
        paidAt: recharge.paidAt,
        credits: recharge.credits,
        amount: recharge.amount,
      };
    }

    const companyCode = this.getCompanyCode(companyId);

    try {
      // Verificar con Yopago
      const verifyRequest = {
        companyCode,
        transactionId: verifyDto.transactionId,
        qrId: verifyDto.qrId,
      };

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.yopagoApiUrl}/pay/qr/verifyQr`,
          verifyRequest
        )
      );

      console.log('📥 Respuesta de verificación Yopago:', response.data);

      // 🔥 CORREGIDO: Verificar la estructura correcta de la respuesta
      if (response.data.status !== 0) {
        throw new BadRequestException(response.data.message || 'Error al verificar QR');
      }

      // 🔥 IMPORTANTE: Yopago puede devolver la información directamente en response.data
      // o en response.data.data dependiendo del endpoint
      const yopagoData = response.data.data || response.data;

      // Verificar si hay datos
      if (!yopagoData) {
        this.logger.warn('Respuesta de Yopago sin datos:', response.data);
        return {
          id: recharge.id,
          transactionId: recharge.transactionId,
          qrId: recharge.qrId,
          qrStatus: recharge.qrStatus,
          paymentStatus: recharge.paymentStatus,
          paidAt: recharge.paidAt,
          credits: recharge.credits,
          amount: recharge.amount,
          message: 'Estado pendiente - esperando pago'
        };
      }

      // 🔥 Actualizar según el estado devuelto por Yopago
      const estado = yopagoData.status || yopagoData.estado || 'PENDING';
      
      if (estado === 'PAID' || estado === 'PAGADO') {
        recharge.qrStatus = QrStatus.PAID;
        recharge.paymentStatus = PaymentStatus.PAID;
        recharge.paidAt = yopagoData.paymentDate ? new Date(yopagoData.paymentDate) : new Date();
        
        await this.rechargeRepository.save(recharge);
        
        // Procesar el pago exitoso
        await this.processSuccessfulPayment(recharge);
        
      } else if (estado === 'EXPIRED' || estado === 'VENCIDO') {
        recharge.qrStatus = QrStatus.EXPIRED;
        recharge.paymentStatus = PaymentStatus.EXPIRED;
        await this.rechargeRepository.save(recharge);
        
      } else if (estado === 'CANCELLED' || estado === 'CANCELADO') {
        recharge.qrStatus = QrStatus.CANCELLED;
        recharge.paymentStatus = PaymentStatus.FAILED;
        await this.rechargeRepository.save(recharge);
        
      } else {
        // Estado PENDING - no es error, solo informar
        this.logger.log(`QR pendiente para transacción: ${verifyDto.transactionId}`);
        
        return {
          id: recharge.id,
          transactionId: recharge.transactionId,
          qrId: recharge.qrId,
          qrStatus: recharge.qrStatus,
          paymentStatus: recharge.paymentStatus,
          paidAt: recharge.paidAt,
          credits: recharge.credits,
          amount: recharge.amount,
          message: yopagoData.message || 'Transacción pendiente - escanee el código QR'
        };
      }

      // Devolver estado actualizado
      return {
        id: recharge.id,
        transactionId: recharge.transactionId,
        qrId: recharge.qrId,
        qrStatus: recharge.qrStatus,
        paymentStatus: recharge.paymentStatus,
        paidAt: recharge.paidAt,
        credits: recharge.credits,
        amount: recharge.amount,
      };
      
    } catch (error) {
      this.logger.error(`Error al verificar QR: ${error.message}`, error.stack);
      
      // Si hay respuesta de error de Yopago, intentar extraer mensaje
      if (error.response?.data?.message) {
        return {
          id: recharge.id,
          transactionId: recharge.transactionId,
          qrId: recharge.qrId,
          qrStatus: recharge.qrStatus,
          paymentStatus: recharge.paymentStatus,
          paidAt: recharge.paidAt,
          credits: recharge.credits,
          amount: recharge.amount,
          message: error.response.data.message
        };
      }
      
      // Si el error es por timeout o conexión, devolver estado actual
      return {
        id: recharge.id,
        transactionId: recharge.transactionId,
        qrId: recharge.qrId,
        qrStatus: recharge.qrStatus,
        paymentStatus: recharge.paymentStatus,
        paidAt: recharge.paidAt,
        credits: recharge.credits,
        amount: recharge.amount,
        message: 'Error al verificar - reintentando...'
      };
    }
  }

  /**
   * Verificar el estado de una transferencia/URL
   */
  async verifyTransferRecharge(companyId: string, verifyDto: VerifyTransactionDto): Promise<any> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Buscar la recarga
    const recharge = await this.rechargeRepository.findOne({
      where: {
        transactionId: verifyDto.transactionId,
        companyId: companyId,
        paymethod: PayMethod.CARD,
      },
    });

    if (!recharge) {
      throw new NotFoundException('Recarga no encontrada');
    }

    // Si ya está pagada, no volver a verificar
    if (recharge.paymentStatus === PaymentStatus.PAID) {
      return {
        id: recharge.id,
        transactionId: recharge.transactionId,
        paymentStatus: recharge.paymentStatus,
        paidAt: recharge.paidAt,
        credits: recharge.credits,
        amount: recharge.amount,
      };
    }

    const companyCode = this.getCompanyCode(companyId);

    try {
      // Verificar con Yopago
      const verifyRequest = {
        companyCode,
        transactionId: verifyDto.transactionId,
      };

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.yopagoApiUrl}/pay/api/verifyTransfer`,
          verifyRequest
        )
      );

      console.log('📥 Respuesta de verificación Yopago:', response.data);

      // Verificar estructura de respuesta
      if (response.data.status !== 0) {
        throw new BadRequestException(response.data.message || 'Error al verificar transferencia');
      }

      const yopagoData = response.data.data || response.data;

      if (!yopagoData) {
        return {
          id: recharge.id,
          transactionId: recharge.transactionId,
          paymentStatus: recharge.paymentStatus,
          paidAt: recharge.paidAt,
          credits: recharge.credits,
          amount: recharge.amount,
          message: 'Estado pendiente'
        };
      }

      const estado = yopagoData.status || yopagoData.estado || 'PENDING';

      if (estado === 'PAID' || estado === 'PAGADO') {
        recharge.paymentStatus = PaymentStatus.PAID;
        recharge.paidAt = yopagoData.paymentDate ? new Date(yopagoData.paymentDate) : new Date();
        
        await this.rechargeRepository.save(recharge);
        await this.processSuccessfulPayment(recharge);
        
      } else if (estado === 'EXPIRED' || estado === 'VENCIDO') {
        recharge.paymentStatus = PaymentStatus.EXPIRED;
        await this.rechargeRepository.save(recharge);
        
      } else if (estado === 'FAILED' || estado === 'FALLIDO') {
        recharge.paymentStatus = PaymentStatus.FAILED;
        await this.rechargeRepository.save(recharge);
        
      } else {
        this.logger.log(`Transferencia pendiente: ${verifyDto.transactionId}`);
        return {
          id: recharge.id,
          transactionId: recharge.transactionId,
          paymentStatus: recharge.paymentStatus,
          paidAt: recharge.paidAt,
          credits: recharge.credits,
          amount: recharge.amount,
          message: yopagoData.message || 'Transacción pendiente'
        };
      }

      return {
        id: recharge.id,
        transactionId: recharge.transactionId,
        paymentStatus: recharge.paymentStatus,
        paidAt: recharge.paidAt,
        credits: recharge.credits,
        amount: recharge.amount,
      };
      
    } catch (error) {
      this.logger.error(`Error al verificar transferencia: ${error.message}`, error.stack);
      
      if (error.response?.data?.message) {
        return {
          id: recharge.id,
          transactionId: recharge.transactionId,
          paymentStatus: recharge.paymentStatus,
          paidAt: recharge.paidAt,
          credits: recharge.credits,
          amount: recharge.amount,
          message: error.response.data.message
        };
      }
      
      return {
        id: recharge.id,
        transactionId: recharge.transactionId,
        paymentStatus: recharge.paymentStatus,
        paidAt: recharge.paidAt,
        credits: recharge.credits,
        amount: recharge.amount,
        message: 'Error al verificar'
      };
    }
  }

  /**
   * Procesar webhook de Yopago (llamada automática cuando cambia el estado)
   */
  async handleYopagoWebhook(body: any): Promise<void> {
    this.logger.log(`Webhook recibido de Yopago: ${JSON.stringify(body)}`);

    // Buscar la recarga por transactionId
    const recharge = await this.rechargeRepository.findOne({
      where: { transactionId: body.transactionId },
    });

    if (!recharge) {
      this.logger.warn(`Recarga no encontrada para transactionId: ${body.transactionId}`);
      return;
    }

    // Actualizar según el tipo de pago
    if (recharge.paymethod === PayMethod.QR) {
      if (body.qrId && body.qrId !== recharge.qrId) {
        this.logger.warn(`QR ID no coincide para transactionId: ${body.transactionId}`);
        return;
      }

      if (body.status === 'PAID' || body.status === 'PAGADO') {
        recharge.qrStatus = QrStatus.PAID;
        recharge.paymentStatus = PaymentStatus.PAID;
        if (body.paymentDate) {
          recharge.paidAt = new Date(body.paymentDate);
        }
        await this.rechargeRepository.save(recharge);
        await this.processSuccessfulPayment(recharge);
        
      } else if (body.status === 'EXPIRED' || body.status === 'VENCIDO') {
        recharge.qrStatus = QrStatus.EXPIRED;
        recharge.paymentStatus = PaymentStatus.EXPIRED;
        await this.rechargeRepository.save(recharge);
        
      } else if (body.status === 'CANCELLED' || body.status === 'CANCELADO') {
        recharge.qrStatus = QrStatus.CANCELLED;
        recharge.paymentStatus = PaymentStatus.FAILED;
        await this.rechargeRepository.save(recharge);
      }
      
    } else {
      // Para pagos con tarjeta
      if (body.status === 'PAID' || body.status === 'PAGADO') {
        recharge.paymentStatus = PaymentStatus.PAID;
        if (body.paymentDate) {
          recharge.paidAt = new Date(body.paymentDate);
        }
        await this.rechargeRepository.save(recharge);
        await this.processSuccessfulPayment(recharge);
        
      } else if (body.status === 'EXPIRED' || body.status === 'VENCIDO') {
        recharge.paymentStatus = PaymentStatus.EXPIRED;
        await this.rechargeRepository.save(recharge);
        
      } else if (body.status === 'FAILED' || body.status === 'FALLIDO') {
        recharge.paymentStatus = PaymentStatus.FAILED;
        await this.rechargeRepository.save(recharge);
      }
    }
  }

  /**
   * Procesar un pago exitoso: acreditar créditos y registrar transacción
   */
  private async processSuccessfulPayment(recharge: CreditRecharge): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Obtener la compañía con bloqueo para evitar condiciones de carrera
      const company = await queryRunner.manager.findOne(Company, {
        where: { id: recharge.companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!company) {
        throw new NotFoundException('Empresa no encontrada');
      }

      const balanceBefore = company.current_credits;
      const balanceAfter = balanceBefore + recharge.credits;

      // Actualizar créditos de la compañía
      await queryRunner.manager.update(
        Company,
        { id: recharge.companyId },
        { current_credits: balanceAfter }
      );

      // Registrar la transacción
      const transaction = new CreditTransaction();
      transaction.id = uuidv4();
      transaction.companyId = recharge.companyId;
      transaction.type = TransactionType.PURCHASE;
      transaction.amount = recharge.credits;
      transaction.balanceBefore = balanceBefore;
      transaction.balanceAfter = balanceAfter;
      transaction.rechargeId = recharge.id;
      transaction.description = `Compra de ${recharge.credits} créditos vía ${recharge.paymethod}`;
      transaction.metadata = {
        paymentId: recharge.transactionId,
        paymentMethod: recharge.paymethod,
        amount: recharge.amount,
        qrId: recharge.qrId,
      };

      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.log(`Pago procesado exitosamente: ${recharge.id} - ${recharge.credits} créditos acreditados a ${recharge.companyId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al procesar pago exitoso: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Obtener el historial de recargas de una empresa
   */
  async getRechargeHistory(companyId: string, limit: number = 20, offset: number = 0): Promise<any> {
    const [recharges, total] = await this.rechargeRepository.findAndCount({
      where: { companyId: companyId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      total,
      limit,
      offset,
      data: recharges.map(recharge => ({
        id: recharge.id,
        paymethod: recharge.paymethod,
        transactionId: recharge.transactionId,
        qrId: recharge.qrId,
        amount: recharge.amount,
        credits: recharge.credits,
        qrStatus: recharge.qrStatus,
        paymentStatus: recharge.paymentStatus,
        createdAt: recharge.createdAt,
        paidAt: recharge.paidAt,
        expiresAt: recharge.expiresAt,
      })),
    };
  }

  /**
   * Obtener costo por canal
   */
  async getChannelCost(channel: Channel): Promise<number> {
    const channelCost = await this.channelCostRepository.findOne({
      where: { channel: channel },
    });

    return channelCost?.costPerMessage || 1;
  }

  /**
   * Verificar si una empresa tiene suficientes créditos
   */
  async hasEnoughCredits(companyId: string, channel: NotificationChannel, recipientCount: number = 1): Promise<boolean> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const costPerMessage = await this.getChannelCost(channel as any);
    const totalCost = costPerMessage * recipientCount;

    return company.current_credits >= totalCost;
  }

  /**
   * Deducir créditos por envío de notificación
   */
  async deductCredits(
    companyId: string,
    channel: NotificationChannel,
    recipient: string,
    referenceId: string,
    queryRunner?: any,
  ): Promise<{ transaction: CreditTransaction; balanceAfter: number }> {
    const useQueryRunner = queryRunner || this.dataSource.createQueryRunner();
    if (!queryRunner) {
      await useQueryRunner.connect();
      await useQueryRunner.startTransaction();
    }

    try {
      // Obtener costo por canal
      const costPerMessage = await this.getChannelCost(channel as any);

      // Obtener la compañía con bloqueo
      const company = await useQueryRunner.manager.findOne(Company, {
        where: { id: companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!company) {
        throw new NotFoundException('Empresa no encontrada');
      }

      // Verificar créditos suficientes
      if (company.current_credits < costPerMessage) {
        throw new BadRequestException(
          `Créditos insuficientes. Necesitas ${costPerMessage} créditos, tienes ${company.current_credits}`
        );
      }

      const balanceBefore = company.current_credits;
      const balanceAfter = balanceBefore - costPerMessage;

      // Actualizar créditos de la compañía
      await useQueryRunner.manager.update(
        Company,
        { id: companyId },
        { current_credits: balanceAfter }
      );

      // Registrar la transacción
      const transaction = new CreditTransaction();
      transaction.id = uuidv4();
      transaction.companyId = companyId;
      transaction.type = TransactionType.DEDUCTION;
      transaction.amount = -costPerMessage;
      transaction.balanceBefore = balanceBefore;
      transaction.balanceAfter = balanceAfter;
      transaction.channel = channel as any;
      transaction.referenceId = referenceId;
      transaction.description = `Envío de ${channel} a ${recipient}`;
      transaction.metadata = {
        channel,
        recipient,
        timestamp: new Date().toISOString(),
      };

      await useQueryRunner.manager.save(transaction);

      if (!queryRunner) {
        await useQueryRunner.commitTransaction();
      }

      // Disparar evento de créditos actualizados
      setTimeout(() => {
        const event = new CustomEvent('credits-updated', {
          detail: {
            companyId,
            credits: balanceAfter,
          },
        });
        (global as any).eventEmitter?.emit('credits-updated', {
          companyId,
          credits: balanceAfter,
        });
      }, 0);

      return {
        transaction,
        balanceAfter,
      };
    } catch (error) {
      if (!queryRunner) {
        await useQueryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (!queryRunner) {
        await useQueryRunner.release();
      }
    }
  }

  /**
   * Tarea programada para marcar como expiradas las recargas pendientes
   * Se ejecuta cada hora
   */
  @Cron('0 * * * *')
  async handleExpiredRecharges() {
    const now = new Date();
    const expiredRecharges = await this.rechargeRepository.find({
      where: {
        paymentStatus: PaymentStatus.PENDING,
        expiresAt: LessThan(now),
      },
    });

    for (const recharge of expiredRecharges) {
      recharge.paymentStatus = PaymentStatus.EXPIRED;
      if (recharge.paymethod === PayMethod.QR) {
        recharge.qrStatus = QrStatus.EXPIRED;
      }
      await this.rechargeRepository.save(recharge);
      this.logger.log(`Recarga expirada: ${recharge.id}`);
    }
  }
}