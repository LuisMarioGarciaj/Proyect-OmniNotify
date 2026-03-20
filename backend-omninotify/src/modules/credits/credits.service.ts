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
  private readonly TIMEZONE_OFFSET = -4; // Bolivia GMT-4

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
      return 'WU59-YZ4B-BCP2-M38Y';
    }
    
    if (companyId === 'undefined' || companyId === 'null') {
      this.logger.error(`❌ companyId es el string "${companyId}" en getCompanyCode`);
      return 'WU59-YZ4B-BCP2-M38Y';
    }
    
    const code = this.companyCodeMap[companyId];
    if (!code) {
      this.logger.warn(`No se encontró código de empresa para companyId: ${companyId}, usando código por defecto`);
      return 'WU59-YZ4B-BCP2-M38Y';
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
   * 🔥 Convertir fecha de Yopago (UTC) a hora local de Bolivia
   * @param dateString Fecha en formato "YYYY-MM-DD HH:MM:SS" (UTC)
   * @returns Date ajustado a Bolivia (GMT-4)
   */
 /**
 * 🔥 Convertir fecha de Yopago (UTC) a hora local de Bolivia
 * @param dateString Fecha en formato "YYYY-MM-DD HH:MM:SS" (UTC)
 * @returns Date ajustado a Bolivia (GMT-4)
 */
private parseYopagoDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  try {
    // Parsear "2026-03-15 19:38:49" (hora Bolivia que recibimos)
    const [datePart, timePart] = dateString.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    
    // Crear fecha como si fuera UTC (para que MySQL no la convierta)
    // Así evitamos la doble conversión
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    
    console.log('📅 Enviando UTC a MySQL:', {
      original: dateString,
      utcString: utcDate.toISOString(),
      mysqlFormat: utcDate.toISOString().slice(0, 19).replace('T', ' ')
    });
    
    return utcDate;
  } catch (error) {
    this.logger.error(`Error parseando fecha: ${dateString}`, error);
    return null;
  }
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
    
    // Fecha de expiración por defecto (24h)
    const defaultExpiresAt = new Date();
    defaultExpiresAt.setDate(defaultExpiresAt.getDate() + 1);
    recharge.expiresAt = defaultExpiresAt;

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

        if (response.data.status !== 0) {
          throw new BadRequestException(response.data.message || 'Error al generar QR');
        }

        yopagoResponse = response.data;
        recharge.transactionId = yopagoResponse.transactionId;
        recharge.qrId = yopagoResponse.qrId;
        recharge.qrImage = yopagoResponse.qr; // Guardar imagen del QR
        
        // 🔥 PARA QR: Yopago NO devuelve fechas al generar, usamos 24h
        console.log('✅ QR generado (expira en 24h):', { 
          transactionId: yopagoResponse.transactionId, 
          qrId: yopagoResponse.qrId,
          expiresAt: recharge.expiresAt
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

        if (response.data.status !== 0) {
          throw new BadRequestException(response.data.message || 'Error al generar URL de pago');
        }

        yopagoResponse = response.data;
        recharge.transactionId = yopagoResponse.transactionId;
        
        // 🔥 PARA URL: Usar dateCreated y expireTime de Yopago
        if (yopagoResponse.dateCreated && yopagoResponse.expireTime) {
          const createdDate = this.parseYopagoDate(yopagoResponse.dateCreated);
          if (createdDate) {
            recharge.createdAt = createdDate;
            
            const expireMinutes = parseInt(yopagoResponse.expireTime);
            const expireDate = new Date(createdDate.getTime() + (expireMinutes * 60 * 1000));
            recharge.expiresAt = expireDate;
            
            console.log('📅 URL con fechas de Yopago:', {
              dateCreated: yopagoResponse.dateCreated,
              expireTime: yopagoResponse.expireTime,
              expiresAt: expireDate
            });
          }
        }
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
          createdAt: recharge.createdAt,
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
          createdAt: recharge.createdAt,
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
   * 🔥 Obtener la imagen de un QR específico
   */
  async getQrImage(companyId: string, rechargeId: string): Promise<{ 
    qrImage: string; 
    expiresAt: Date; 
    amount: number; 
    credits: number;
    createdAt?: Date;
  }> {
    const recharge = await this.rechargeRepository.findOne({
      where: { 
        id: rechargeId,
        companyId: companyId,
        paymethod: PayMethod.QR
      }
    });

    if (!recharge) {
      throw new NotFoundException('QR no encontrado');
    }

    // Verificar expiración
    if (recharge.expiresAt && new Date() > recharge.expiresAt) {
      if (recharge.paymentStatus === PaymentStatus.PENDING) {
        recharge.paymentStatus = PaymentStatus.EXPIRED;
        recharge.qrStatus = QrStatus.EXPIRED;
        await this.rechargeRepository.save(recharge);
      }
      throw new BadRequestException('El QR ha expirado');
    }

    if (!recharge.qrImage) {
      throw new NotFoundException('La imagen del QR no está disponible');
    }

    return {
      qrImage: recharge.qrImage,
      expiresAt: recharge.expiresAt,
      amount: recharge.amount,
      credits: recharge.credits,
      createdAt: recharge.createdAt
    };
  }

  /**
   * 🔥 Procesar confirmación de pago desde callback de Yopago
   */
  async processPaymentConfirmation(paymentData: any): Promise<any> {
    console.log('💰 [PAYMENT CONFIRMATION] Procesando confirmación de pago:', paymentData);

    const transactionId = paymentData.transactionId || paymentData.transaction_id;
    
    if (!transactionId) {
      throw new BadRequestException('Se requiere transactionId');
    }

    const recharge = await this.rechargeRepository.findOne({
      where: { 
        transactionId: transactionId,
        paymentStatus: PaymentStatus.PENDING 
      }
    });

    if (!recharge) {
      console.log(`⚠️ [PAYMENT CONFIRMATION] No se encontró recarga pendiente para transactionId: ${transactionId}`);
      
      const paidRecharge = await this.rechargeRepository.findOne({
        where: { transactionId: transactionId }
      });
      
      if (paidRecharge && paidRecharge.paymentStatus === PaymentStatus.PAID) {
        console.log(`✅ [PAYMENT CONFIRMATION] La recarga ${transactionId} ya fue procesada anteriormente`);
        return {
          id: paidRecharge.id,
          transactionId: paidRecharge.transactionId,
          status: 'already_processed',
          credits: paidRecharge.credits,
          paidAt: paidRecharge.paidAt
        };
      }
      
      throw new NotFoundException(`No se encontró recarga pendiente con transactionId: ${transactionId}`);
    }

    if (recharge.paymentStatus === PaymentStatus.PAID) {
      console.log(`⚠️ [PAYMENT CONFIRMATION] La recarga ${transactionId} ya está pagada`);
      return {
        id: recharge.id,
        transactionId: recharge.transactionId,
        status: 'already_paid',
        credits: recharge.credits,
        paidAt: recharge.paidAt
      };
    }

    recharge.qrStatus = QrStatus.PAID;
    recharge.paymentStatus = PaymentStatus.PAID;
    recharge.paidAt = new Date();

    await this.rechargeRepository.save(recharge);
    
    console.log(`✅ [PAYMENT CONFIRMATION] Recarga actualizada a PAID:`, {
      id: recharge.id,
      paidAt: recharge.paidAt
    });

    await this.processSuccessfulPayment(recharge);

    const company = await this.companyRepository.findOne({
      where: { id: recharge.companyId }
    });

    return {
      id: recharge.id,
      transactionId: recharge.transactionId,
      companyId: recharge.companyId,
      credits: recharge.credits,
      amount: recharge.amount,
      newBalance: company?.current_credits || 0,
      paidAt: recharge.paidAt,
      status: 'success'
    };
  }

  /**
   * Verificar el estado de una recarga (QR)
   */
  async verifyQrRecharge(companyId: string, verifyDto: VerifyQrDto): Promise<any> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

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

      if (response.data.status !== 0) {
        throw new BadRequestException(response.data.message || 'Error al verificar QR');
      }

      const yopagoData = response.data.data || response.data;

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

      // 🔥 Guardar las fechas que Yopago devuelve en la verificación
      let fechasActualizadas = false;
      
      if (yopagoData.dateCreated) {
        const createdDate = this.parseYopagoDate(yopagoData.dateCreated);
        if (createdDate) {
          recharge.createdAt = createdDate;
          fechasActualizadas = true;
          console.log('📅 Actualizando createdAt desde verificación:', {
            original: yopagoData.dateCreated,
            convertida: createdDate
          });
        }
      }

      if (yopagoData.dateExpired) {
        const expiredDate = this.parseYopagoDate(yopagoData.dateExpired);
        if (expiredDate) {
          recharge.expiresAt = expiredDate;
          fechasActualizadas = true;
          console.log('📅 Actualizando expiresAt desde verificación:', {
            original: yopagoData.dateExpired,
            convertida: expiredDate
          });
        }
      }

      if (fechasActualizadas) {
        await this.rechargeRepository.save(recharge);
      }

      const estado = yopagoData.msgQr || yopagoData.status || yopagoData.estado || 'PENDING';
      const estadoUpper = String(estado).toUpperCase();
      
      console.log(`📊 Estado detectado: ${estado} (${estadoUpper})`);

      if (estadoUpper === 'APPROVED' || estadoUpper === 'PAID' || estadoUpper === 'PAGADO' || estadoUpper === 'COMPLETED') {
        console.log('💰 Pago detectado como exitoso! Procesando...');
        
        recharge.qrStatus = QrStatus.PAID;
        recharge.paymentStatus = PaymentStatus.PAID;
        
        if (yopagoData.dateCreated) {
          recharge.paidAt = new Date(yopagoData.dateCreated);
        } else {
          recharge.paidAt = new Date();
        }
        
        await this.rechargeRepository.save(recharge);
        await this.processSuccessfulPayment(recharge);
        
        console.log(`✅ Pago procesado exitosamente. Créditos acreditados: ${recharge.credits}`);
        
      } else if (estadoUpper === 'EXPIRED' || estadoUpper === 'VENCIDO') {
        recharge.qrStatus = QrStatus.EXPIRED;
        recharge.paymentStatus = PaymentStatus.EXPIRED;
        await this.rechargeRepository.save(recharge);
        
      } else if (estadoUpper === 'CANCELLED' || estadoUpper === 'CANCELADO' || estadoUpper === 'FAILED') {
        recharge.qrStatus = QrStatus.CANCELLED;
        recharge.paymentStatus = PaymentStatus.FAILED;
        await this.rechargeRepository.save(recharge);
        
      } else {
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
      const estadoUpper = String(estado).toUpperCase();

      if (estadoUpper === 'PAID' || estadoUpper === 'PAGADO' || estadoUpper === 'COMPLETED' || estadoUpper === 'APPROVED') {
        recharge.paymentStatus = PaymentStatus.PAID;
        recharge.paidAt = yopagoData.paymentDate ? new Date(yopagoData.paymentDate) : new Date();
        
        await this.rechargeRepository.save(recharge);
        await this.processSuccessfulPayment(recharge);
        
      } else if (estadoUpper === 'EXPIRED' || estadoUpper === 'VENCIDO') {
        recharge.paymentStatus = PaymentStatus.EXPIRED;
        await this.rechargeRepository.save(recharge);
        
      } else if (estadoUpper === 'FAILED' || estadoUpper === 'FALLIDO' || estadoUpper === 'CANCELLED') {
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
   * Procesar webhook de Yopago
   */
  async handleYopagoWebhook(body: any): Promise<void> {
    this.logger.log(`Webhook recibido de Yopago: ${JSON.stringify(body)}`);

    const recharge = await this.rechargeRepository.findOne({
      where: { transactionId: body.transactionId },
    });

    if (!recharge) {
      this.logger.warn(`Recarga no encontrada para transactionId: ${body.transactionId}`);
      return;
    }

    if (recharge.paymethod === PayMethod.QR) {
      if (body.qrId && body.qrId !== recharge.qrId) {
        this.logger.warn(`QR ID no coincide para transactionId: ${body.transactionId}`);
        return;
      }

      const estado = body.status || body.msgQr || 'PENDING';
      const estadoUpper = String(estado).toUpperCase();

      if (estadoUpper === 'PAID' || estadoUpper === 'PAGADO' || estadoUpper === 'APPROVED' || estadoUpper === 'COMPLETED') {
        recharge.qrStatus = QrStatus.PAID;
        recharge.paymentStatus = PaymentStatus.PAID;
        if (body.paymentDate || body.dateCreated) {
          recharge.paidAt = new Date(body.paymentDate || body.dateCreated);
        }
        await this.rechargeRepository.save(recharge);
        await this.processSuccessfulPayment(recharge);
        
      } else if (estadoUpper === 'EXPIRED' || estadoUpper === 'VENCIDO') {
        recharge.qrStatus = QrStatus.EXPIRED;
        recharge.paymentStatus = PaymentStatus.EXPIRED;
        await this.rechargeRepository.save(recharge);
        
      } else if (estadoUpper === 'CANCELLED' || estadoUpper === 'CANCELADO' || estadoUpper === 'FAILED') {
        recharge.qrStatus = QrStatus.CANCELLED;
        recharge.paymentStatus = PaymentStatus.FAILED;
        await this.rechargeRepository.save(recharge);
      }
      
    } else {
      const estado = body.status || body.estado || 'PENDING';
      const estadoUpper = String(estado).toUpperCase();

      if (estadoUpper === 'PAID' || estadoUpper === 'PAGADO' || estadoUpper === 'APPROVED' || estadoUpper === 'COMPLETED') {
        recharge.paymentStatus = PaymentStatus.PAID;
        if (body.paymentDate || body.dateCreated) {
          recharge.paidAt = new Date(body.paymentDate || body.dateCreated);
        }
        await this.rechargeRepository.save(recharge);
        await this.processSuccessfulPayment(recharge);
        
      } else if (estadoUpper === 'EXPIRED' || estadoUpper === 'VENCIDO') {
        recharge.paymentStatus = PaymentStatus.EXPIRED;
        await this.rechargeRepository.save(recharge);
        
      } else if (estadoUpper === 'FAILED' || estadoUpper === 'FALLIDO' || estadoUpper === 'CANCELLED') {
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
      console.log(`💰 Procesando pago exitoso para recarga: ${recharge.id}, créditos: ${recharge.credits}`);

      const company = await queryRunner.manager.findOne(Company, {
        where: { id: recharge.companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!company) {
        throw new NotFoundException('Empresa no encontrada');
      }

      const balanceBefore = company.current_credits;
      const balanceAfter = balanceBefore + recharge.credits;

      console.log(`💰 Balance antes: ${balanceBefore}, después: ${balanceAfter}`);

      await queryRunner.manager.update(
        Company,
        { id: recharge.companyId },
        { current_credits: balanceAfter }
      );

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
        paidAt: recharge.paidAt,
      };

      await queryRunner.manager.save(transaction);
      await queryRunner.commitTransaction();

      console.log(`✅ Pago procesado exitosamente: ${recharge.id} - ${recharge.credits} créditos acreditados a ${recharge.companyId}`);
      console.log(`💰 Nuevo saldo: ${balanceAfter}`);
      
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
      const costPerMessage = await this.getChannelCost(channel as any);

      const company = await useQueryRunner.manager.findOne(Company, {
        where: { id: companyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!company) {
        throw new NotFoundException('Empresa no encontrada');
      }

      if (company.current_credits < costPerMessage) {
        throw new BadRequestException(
          `Créditos insuficientes. Necesitas ${costPerMessage} créditos, tienes ${company.current_credits}`
        );
      }

      const balanceBefore = company.current_credits;
      const balanceAfter = balanceBefore - costPerMessage;

      await useQueryRunner.manager.update(
        Company,
        { id: companyId },
        { current_credits: balanceAfter }
      );

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

      setTimeout(() => {
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