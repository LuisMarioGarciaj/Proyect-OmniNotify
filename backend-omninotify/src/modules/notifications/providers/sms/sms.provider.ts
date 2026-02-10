// src/modules/notifications/providers/sms.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { Vonage } from '@vonage/server-sdk';

export interface SMSConfig {
  provider: 'vonage' | 'twilio';
  apiKey?: string;
  apiSecret?: string;
  fromNumber?: string;
  accountSid?: string;
  authToken?: string;
}

export interface SMSContent {
  to: string;
  text: string;
  from?: string;
  type?: 'text' | 'unicode';
  webhookUrl?: string;
  clientRef?: string;
}

@Injectable()
export class SMSProvider {
  private readonly logger = new Logger(SMSProvider.name);
  private vonageClient: Vonage | null = null;

  async send(config: SMSConfig, payload: SMSContent): Promise<any> {
    this.logger.debug('📱 SMSProvider.send() llamado');
    
    try {
      this.validateConfig(config);
      this.validatePayload(payload);

      if (config.provider === 'vonage') {
        return await this.sendViaVonage(config, payload);
      } else if (config.provider === 'twilio') {
        throw new Error('Twilio no implementado aún');
      } else {
        throw new Error(`Proveedor no soportado: ${config.provider}`);
      }
    } catch (error: any) {
      this.logger.error(`❌ Error enviando SMS: ${error.message}`);
      throw new Error(`SMS Provider Error: ${error.message}`);
    }
  }

  private async sendViaVonage(config: SMSConfig, payload: SMSContent) {
    if (!this.vonageClient) {
      this.vonageClient = new Vonage({
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
      });
    }

    const fromNumber = payload.from || config.fromNumber || process.env.VONAGE_FROM_NUMBER;
    
    if (!fromNumber) {
      throw new Error('Número de origen no configurado');
    }

    const toNumber = this.formatToE164(payload.to);
    
    this.logger.debug(`📤 Enviando: ${fromNumber} → ${toNumber}`);

    const smsOptions: any = {
      to: toNumber,
      from: fromNumber,
      text: payload.text,
      type: payload.type || 'text',
    };

    if (payload.webhookUrl) smsOptions.webhookUrl = payload.webhookUrl;
    if (payload.clientRef) smsOptions.clientRef = payload.clientRef;

    const response = await this.vonageClient.sms.send(smsOptions);

    if (response.messages && response.messages[0]) {
      const message = response.messages[0];
      
      if (message.status === '0') {
        return {
          success: true,
          provider: 'vonage',
          messageId: message['message-id'],
          to: message.to,
          remainingBalance: message['remaining-balance'],
          messagePrice: message['message-price'],
          network: message.network,
          status: 'sent',
        };
      } else {
        throw new Error(`Vonage API Error: ${message['error-text']} (${message.status})`);
      }
    }

    throw new Error('Respuesta inesperada de Vonage');
  }

  private validateConfig(config: SMSConfig): void {
    if (!config.provider) {
      throw new Error('Proveedor SMS no especificado');
    }

    if (config.provider === 'vonage') {
      const missingFields: string[] = [];
      if (!config.apiKey) missingFields.push('apiKey');
      if (!config.apiSecret) missingFields.push('apiSecret');
      
      if (missingFields.length > 0) {
        throw new Error(`Faltan campos Vonage: ${missingFields.join(', ')}`);
      }
    }
  }

  private validatePayload(payload: SMSContent): void {
    if (!payload.to) {
      throw new Error('Número de destino requerido');
    }

    if (!payload.text?.trim()) {
      throw new Error('Texto del mensaje requerido');
    }

    if (!this.isValidE164(payload.to)) {
      throw new Error('Formato de número inválido. Use formato E.164: +521234567890');
    }

    if (payload.text.length > 1600) {
      throw new Error('Mensaje demasiado largo (máximo 1600 caracteres)');
    }
  }

  isValidE164(phoneNumber: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  formatToE164(phoneNumber: string, defaultCountryCode: string = '52'): string {
    let cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    if (cleanNumber.startsWith('+')) {
      return cleanNumber;
    }
    
    if (cleanNumber.startsWith('00')) {
      cleanNumber = '+' + cleanNumber.substring(2);
      return cleanNumber;
    }
    
    if (cleanNumber.startsWith('0')) {
      cleanNumber = cleanNumber.substring(1);
    }
    
    if (!cleanNumber.startsWith('+')) {
      cleanNumber = '+' + defaultCountryCode + cleanNumber;
    }
    
    return cleanNumber;
  }

  // MÉTODO getBalance CORREGIDO - AQUÍ VA LA SOLUCIÓN
  async getBalance(config: SMSConfig): Promise<number> {
    if (config.provider !== 'vonage') {
      throw new Error('Solo disponible para Vonage');
    }

    if (!config.apiKey || !config.apiSecret) {
      throw new Error('Credenciales Vonage requeridas');
    }

    const vonage = new Vonage({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
    });

    try {
      // Usar 'any' temporalmente para evitar problemas de tipos
      const balance: any = await vonage.accounts.getBalance();
      
      // Depuración (puedes comentar estas líneas después)
      this.logger.debug('DEBUG - Tipo de balance:', typeof balance);
      this.logger.debug('DEBUG - Balance completo:', JSON.stringify(balance, null, 2));
      
      // Verificar diferentes estructuras posibles
      if (balance && typeof balance === 'object') {
        // Estructura: { value: number, autoReload: boolean, ... }
        if (balance.value !== undefined) {
          const value = Number(balance.value);
          return isNaN(value) ? 0 : value;
        }
        
        // Estructura: { balance: number, ... }
        if (balance.balance !== undefined) {
          const value = Number(balance.balance);
          return isNaN(value) ? 0 : value;
        }
        
        // Estructura: { amount: number, ... }
        if (balance.amount !== undefined) {
          const value = Number(balance.amount);
          return isNaN(value) ? 0 : value;
        }
      }
      
      // Si es directamente un número
      if (typeof balance === 'number') {
        return balance;
      }
      
      // Si es una string
      if (typeof balance === 'string') {
        const value = parseFloat(balance);
        return isNaN(value) ? 0 : value;
      }
      
      this.logger.warn('Estructura de balance desconocida:', balance);
      return 0;
      
    } catch (error: any) {
      this.logger.error('Error obteniendo balance:', error.message);
      throw new Error(`No se pudo obtener balance: ${error.message}`);
    }
  }

  // MÉTODO testConnection actualizado para usar getBalance
  async testConnection(config: SMSConfig): Promise<boolean> {
    try {
      if (config.provider === 'vonage') {
        if (!config.apiKey || !config.apiSecret) return false;
        
        // Usar getBalance para probar la conexión
        await this.getBalance(config);
        return true;
      }
      
      return false;
    } catch (error: any) {
      this.logger.error('Error probando conexión SMS:', error.message);
      return false;
    }
  }
}