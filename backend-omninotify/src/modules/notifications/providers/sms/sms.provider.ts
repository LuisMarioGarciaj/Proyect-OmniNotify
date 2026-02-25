// src/modules/notifications/providers/sms.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { Vonage } from '@vonage/server-sdk';
import { SystemConfigService, VonageCredentials } from '../../../system/services/system-config.service';

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
  private currentApiKey: string | null = null;
  private currentApiSecret: string | null = null;

  constructor(
    private readonly systemConfigService: SystemConfigService, // ✅ INYECTAR
  ) {}
  async send(config: SMSConfig, payload: SMSContent): Promise<any> {
    this.logger.debug('📱 SMSProvider.send() llamado');
    
    try {
      // Si no se proporciona config específica, usar la global de BD
      if (!config.apiKey || !config.apiSecret) {
        const globalConfig = await this.systemConfigService.getVonageCredentials();
        config = {
          provider: 'vonage',
          apiKey: globalConfig.apiKey,
          apiSecret: globalConfig.apiSecret,
          fromNumber: globalConfig.fromNumber,
        };
      }

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
    if (!this.vonageClient || 
         this.currentApiKey !== config.apiKey || 
         this.currentApiSecret !== config.apiSecret) {
      this.vonageClient = new Vonage({
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
      });
      this.currentApiKey = config.apiKey!;
      this.currentApiSecret = config.apiSecret!;
    }

    const fromNumber = payload.from || config.fromNumber ||'OmniNotify';
    
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
  async getBalance(config?: SMSConfig): Promise<number> {
    try {
      // Si no se proporciona config, usar la global de BD
      if (!config) {
        const globalConfig = await this.systemConfigService.getVonageCredentials();
        config = {
          provider: 'vonage',
          apiKey: globalConfig.apiKey,
          apiSecret: globalConfig.apiSecret,
        };
      }
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

    
      // Usar 'any' temporalmente para evitar problemas de tipos
      const balance: any = await vonage.accounts.getBalance();
      
      // Depuración (puedes comentar estas líneas después)
      this.logger.debug('DEBUG - Tipo de balance:', typeof balance);
      this.logger.debug('DEBUG - Balance completo:', JSON.stringify(balance, null, 2));
      
       if (balance && typeof balance === 'object') {
        if (balance.value !== undefined) {
          return Number(balance.value) || 0;
        }
        if (balance.balance !== undefined) {
          return Number(balance.balance) || 0;
        }
        if (balance.amount !== undefined) {
          return Number(balance.amount) || 0;
        }
      }
      
      if (typeof balance === 'number') {
        return balance;
      }
      
      if (typeof balance === 'string') {
        return parseFloat(balance) || 0;
      }
      
      return 0;
    } catch (error: any) {
      this.logger.error(`Error obteniendo balance: ${error.message}`);
      throw new Error(`No se pudo obtener balance: ${error.message}`);
    }
  }

 async testConnection(config?: SMSConfig): Promise<boolean> {
    try {
      await this.getBalance(config);
      return true;
    } catch (error: any) {
      this.logger.error(`Error probando conexión SMS: ${error.message}`);
      return false;
    }
  }
}