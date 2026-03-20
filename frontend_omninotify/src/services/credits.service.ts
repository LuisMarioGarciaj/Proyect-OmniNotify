import { api } from './api';

export interface BalanceResponse {
  credits: number;
  companyName: string;
}

export interface RechargeResponse {
  id: string;
  transactionId: string;
  qrId?: string;
  qrCode?: string;
  paymentUrl?: string;
  amount: number;
  credits: number;
  expiresAt: string;
  qrStatus: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
}

export interface VerifyResponse {
  id: string;
  transactionId: string;
  qrId?: string;
  qrStatus: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
  paidAt?: string;
  credits: number;
  amount: number;
  message?: string;
}

export interface RechargeHistoryItem {
  id: string;
  paymethod: 'QR' | 'CARD' | 'STRIKE';
  transactionId: string;
  qrId?: string;
  amount: number;
  credits: number;
  qrStatus: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
  createdAt: string;
  paidAt?: string;
  expiresAt?: string;
}

export interface RechargeHistoryResponse {
  total: number;
  limit: number;
  offset: number;
  data: RechargeHistoryItem[];
}

export interface QrImageResponse {
  qrImage: string;
  expiresAt: string;
  amount: number;
  credits: number;
}

export interface PurchaseCreditsDto {
  method: 'CARD' | 'QR' | 'STRIKE';
  amount: number;
  credits: number;
  billName?: string;
  billNit?: string;
  email?: string;
  concept?: string;
}

export interface GenerateQrDto {
  amount: number;
  credits: number;
  billName?: string;
  billNit?: string;
  email?: string;
  concept?: string;
}

export interface GenerateUrlDto {
  amount: number;
  credits: number;
  billName?: string;
  billNit?: string;
  email?: string;
  concept?: string;
}

export interface VerifyQrDto {
  transactionId: string;
  qrId: string;
}

export interface VerifyTransactionDto {
  transactionId: string;
}

export interface ChannelCostResponse {
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  cost: number;
}

class CreditsService {
  private readonly baseUrl = '/credits';

  /**
   * Obtener saldo actual de créditos para una empresa específica
   */
  async getBalance(companyId: string): Promise<BalanceResponse> {
    try {
      console.log('💰 CreditsService: Solicitando balance para companyId:', companyId);
      
      const response = await api.get(`${this.baseUrl}/balance?companyId=${companyId}`);
      
      console.log('💰 CreditsService: Respuesta recibida:', response);
      
      return response as BalanceResponse;
    } catch (error) {
      console.error('❌ CreditsService: Error en getBalance:', error);
      throw error;
    }
  }

  /**
   * Crear una nueva recarga de créditos (unificado)
   */
  async purchaseCredits(data: PurchaseCreditsDto): Promise<RechargeResponse> {
    try {
      console.log('💰 CreditsService: purchaseCredits - data:', data);
      console.log('📡 Enviando POST a:', `${this.baseUrl}/purchase`);
      
      const response = await api.post(`${this.baseUrl}/purchase`, data);
      
      console.log('💰 CreditsService: purchaseCredits response:', response);
      
      return response as RechargeResponse;
    } catch (error) {
      console.error('❌ CreditsService: Error en purchaseCredits:', error);
      throw error;
    }
  }

  /**
   * Generar QR de pago (mantenido por compatibilidad)
   */
  async generateQr(data: GenerateQrDto): Promise<RechargeResponse> {
    console.log('💰 CreditsService: generateQr - data:', data);
    
    const purchaseData: PurchaseCreditsDto = {
      method: 'QR',
      amount: data.amount,
      credits: data.credits,
      billName: data.billName,
      billNit: data.billNit,
      email: data.email,
      concept: data.concept,
    };
    
    return this.purchaseCredits(purchaseData);
  }

  /**
   * Generar URL de pago con tarjeta (mantenido por compatibilidad)
   */
  async generateUrl(data: GenerateUrlDto): Promise<RechargeResponse> {
    console.log('💰 CreditsService: generateUrl - data:', data);
    
    const purchaseData: PurchaseCreditsDto = {
      method: 'CARD',
      amount: data.amount,
      credits: data.credits,
      billName: data.billName,
      billNit: data.billNit,
      email: data.email,
      concept: data.concept,
    };
    
    return this.purchaseCredits(purchaseData);
  }

  /**
   * Verificar estado de un pago por QR
   */
  async verifyQr(data: VerifyQrDto): Promise<VerifyResponse> {
    try {
      console.log('💰 CreditsService: verifyQr - data:', data);
      
      const response = await api.post(`${this.baseUrl}/verify-qr`, data);
      
      console.log('💰 CreditsService: verifyQr response:', response);
      
      return response as VerifyResponse;
    } catch (error) {
      console.error('❌ CreditsService: Error en verifyQr:', error);
      throw error;
    }
  }

  /**
   * Verificar estado de una transferencia/pago con tarjeta
   */
  async verifyTransaction(data: VerifyTransactionDto): Promise<VerifyResponse> {
    try {
      console.log('💰 CreditsService: verifyTransaction - data:', data);
      
      const response = await api.post(`${this.baseUrl}/verify-transaction`, data);
      
      console.log('💰 CreditsService: verifyTransaction response:', response);
      
      return response as VerifyResponse;
    } catch (error) {
      console.error('❌ CreditsService: Error en verifyTransaction:', error);
      throw error;
    }
  }

  /**
   * Obtener historial de recargas
   */
  async getRechargeHistory(companyId: string, limit: number = 20, offset: number = 0): Promise<RechargeHistoryResponse> {
    try {
      console.log(`📜 CreditsService: Solicitando historial para companyId: ${companyId}`);
      
      const response = await api.get(`${this.baseUrl}/history?companyId=${companyId}&limit=${limit}&offset=${offset}`);
      
      console.log('📜 CreditsService: Historial recibido:', response);
      
      return response as RechargeHistoryResponse;
    } catch (error) {
      console.error('❌ CreditsService: Error en getRechargeHistory:', error);
      throw error;
    }
  }

  /**
   * 🔥 Obtener imagen de QR por ID de recarga
   */
  async getQrImage(rechargeId: string): Promise<QrImageResponse> {
    try {
      console.log(`📸 CreditsService: Obteniendo QR para recarga: ${rechargeId}`);
      const response = await api.get(`${this.baseUrl}/qr/${rechargeId}`);
      console.log('📸 QR obtenido:', response);
      return response as QrImageResponse;
    } catch (error) {
      console.error('❌ CreditsService: Error obteniendo QR:', error);
      throw error;
    }
  }

  /**
   * Obtener costo por canal
   */
  async getChannelCost(channel: 'EMAIL' | 'SMS' | 'WHATSAPP'): Promise<ChannelCostResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/channel-cost/${channel}`);
      console.log(`💰 CreditsService: getChannelCost(${channel}) response:`, response);
      
      return response as ChannelCostResponse;
    } catch (error) {
      console.error(`❌ CreditsService: Error en getChannelCost(${channel}):`, error);
      return {
        channel,
        cost: channel === 'SMS' ? 2 : 1
      };
    }
  }

  /**
   * Calcular créditos basado en monto (1 Bs = 1 crédito)
   */
  calculateCredits(amount: number): number {
    return Math.floor(amount);
  }

  /**
   * Calcular monto basado en créditos (1 crédito = 1 Bs)
   */
  calculateAmount(credits: number): number {
    return credits;
  }
}

export const creditsService = new CreditsService();