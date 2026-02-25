// src/services/credits.service.ts
import { api } from './api';

export interface CreditsPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  popular?: boolean;
  description?: string;
  isTest?: boolean;
}

export interface CreditsBalance {
  currentBalance: number;
  companyId: string;
  lastUpdated: string;
}

// 🔥 CORREGIDO: Adaptado a la respuesta real del backend
export interface QrResponse {
  success: boolean;
  qrData: {
    status: number;
    transactionId: string;
    qrId: string;
    qr: string;
  };
  companyId: string;
  amount: number;
  transactionCode: string;
}

export interface PaymentVerificationResponse {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  paymentId?: string;
  amount?: string;
  credits?: {
    success: boolean;
    message: string;
    newBalance: number;
    transaction: any;
  };
}

export interface RechargeResponse {
  success: boolean;
  message: string;
  transaction: any;
  newBalance: number;
}

export const creditsService = {
  /**
   * Obtiene el saldo actual de créditos
   */
  getBalance: async (companyId: string): Promise<CreditsBalance> => {
    const response = await api.get(`/credits/balance?companyId=${companyId}`);
    return response;
  },

  /**
   * Obtiene el historial de transacciones
   */
  getHistory: async (companyId: string, page: number = 1, perPage: number = 20) => {
    const response = await api.get(`/credits/history?companyId=${companyId}&page=${page}&perPage=${perPage}`);
    return response;
  },

  /**
   * Genera código QR para pago
   */
  generateQr: async (data: {
    companyId: string;
    amount: number;
    concept?: string;
    email?: string;
    billName?: string;
  }): Promise<QrResponse> => {
    console.log('📤 Enviando solicitud QR:', {
      amount: data.amount,
      concept: data.concept,
      email: data.email,
      billName: data.billName
    });
    
    const response = await api.post('/credits/qr/generate', {
      amount: data.amount,
      concept: data.concept || 'Recarga de créditos',
      email: data.email,
      billName: data.billName,
    });
    
    console.log('📥 Respuesta del servidor:', response);
    
    return response; // La respuesta ya tiene la estructura { success, qrData, ... }
  },

  /**
   * Verifica estado del pago QR
   */
  verifyQrPayment: async (transactionId: string, qrId: string): Promise<PaymentVerificationResponse> => {
    const response = await api.post('/credits/qr/verify', {
      transactionId,
      qrId,
    });
    return response;
  },

  /**
   * Genera URL de pago (alternativa al QR)
   */
  generatePaymentUrl: async (data: {
    companyId: string;
    amount: number;
    concept?: string;
    email?: string;
  }) => {
    const response = await api.post('/credits/url/generate', {
      amount: data.amount,
      concept: data.concept,
      email: data.email,
    });
    return response;
  },

  /**
   * Recarga créditos (método legacy)
   */
  rechargeCredits: async (data: {
    company_id: string;
    package_id: string;
    payment_method: 'card' | 'transfer' | 'qr';
  }): Promise<RechargeResponse> => {
    const packages = await creditsService.getCreditsPackages();
    const selectedPackage = packages.find(p => p.id === data.package_id);
    
    if (!selectedPackage) {
      throw new Error('Paquete no encontrado');
    }

    const response = await api.post('/credits/purchase', {
      companyId: data.company_id,
      amount: selectedPackage.credits,
      paymentMethod: data.payment_method,
      paymentId: `PAY-${Date.now()}`,
      metadata: {
        packageId: data.package_id,
        packageName: selectedPackage.name,
        isTest: selectedPackage.isTest || false
      }
    });

    return response;
  },

  /**
   * 🔥 MÉTODO ESPECIAL PARA PRUEBAS - Simula pago exitoso inmediato
   */
  simulateTestPayment: async (companyId: string, packageId: string): Promise<RechargeResponse> => {
    const packages = await creditsService.getCreditsPackages();
    const selectedPackage = packages.find(p => p.id === packageId);
    
    if (!selectedPackage) {
      throw new Error('Paquete no encontrado');
    }

    // Usar endpoint de simulación
    const response = await api.post('/credits/simulate-purchase', {
      companyId,
      amount: selectedPackage.credits
    });

    return response;
  },

  /**
   * Obtiene los paquetes de créditos disponibles
   */
  getCreditsPackages: async (): Promise<CreditsPackage[]> => {
    return [
      // Paquetes económicos (1 Bs)
      {
        id: 'test-1',
        name: '🧪 TEST - Mínimo',
        credits: 2,
        price: 1,
        description: 'SOLO PARA PRUEBAS - 2 créditos por 1 Bs',
        isTest: true
      },
      {
        id: 'test-5',
        name: '🧪 TEST - Pequeño',
        credits: 10,
        price: 1,
        description: 'SOLO PARA PRUEBAS - 10 créditos por 1 Bs',
        isTest: true
      },
      {
        id: 'test-10',
        name: '🧪 TEST - Mediano',
        credits: 20,
        price: 1,
        description: 'SOLO PARA PRUEBAS - 20 créditos por 1 Bs',
        isTest: true
      },
      
      // Paquetes reales
      {
        id: '1',
        name: 'Básico',
        credits: 100,
        price: 50,
        description: 'Para empezar - 100 créditos (0.50 Bs por crédito)'
      },
      {
        id: '2',
        name: 'Profesional',
        credits: 500,
        price: 200,
        popular: true,
        description: 'Para negocios en crecimiento - 500 créditos (0.40 Bs por crédito)'
      },
      {
        id: '3',
        name: 'Empresarial',
        credits: 2000,
        price: 750,
        description: 'Para envíos masivos - 2000 créditos (0.375 Bs por crédito)'
      },
      {
        id: '4',
        name: 'Corporativo',
        credits: 5000,
        price: 1750,
        description: 'Para grandes volúmenes - 5000 créditos (0.35 Bs por crédito)'
      }
    ];
  }
};