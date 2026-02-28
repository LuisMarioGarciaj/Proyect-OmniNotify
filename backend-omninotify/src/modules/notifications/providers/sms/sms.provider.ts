// src/modules/notifications/providers/sms/sms.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { Vonage } from '@vonage/server-sdk';
import { Twilio } from 'twilio'; // <--- IMPORTAR TWILIO
import { SystemConfigService } from '../../../system/services/system-config.service'; // Ajusta la ruta
// Importa las interfaces si las moviste a un archivo compartido
import type { VonageCredentials, TwilioCredentials } from '../../../system/interfaces/system-config.interface';

export interface SMSConfig {
  provider: 'vonage' | 'twilio';
  // Vonage
  apiKey?: string;
  apiSecret?: string;
  // Twilio
  accountSid?: string;
  authToken?: string;
  // Común
  fromNumber?: string;
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
  
  // Clientes cacheados para evitar recrearlos en cada envío
  private vonageClient: Vonage | null = null;
  private twilioClient: Twilio | null = null;
  
  // Guardamos las credenciales usadas para cada cliente
  private currentVonageKey: string | null = null;
  private currentVonageSecret: string | null = null;
  private currentTwilioSid: string | null = null;
  private currentTwilioToken: string | null = null;

  constructor(
    private readonly systemConfigService: SystemConfigService, // Inyectamos el servicio
  ) {}

  async send(config: SMSConfig, payload: SMSContent): Promise<any> {
    this.logger.debug(`📱 SMSProvider.send() llamado para proveedor: ${config.provider}`);
    
    try {
      // --- LÓGICA PARA USAR CREDENCIALES GLOBALES POR DEFECTO ---
      let finalConfig = { ...config };

      // Si faltan credenciales específicas, intentamos cargar las globales
      if (config.provider === 'vonage' && (!config.apiKey || !config.apiSecret)) {
        this.logger.log('📦 Usando credenciales globales de Vonage');
        const globalCreds = await this.systemConfigService.getVonageCredentials();
        finalConfig.apiKey = globalCreds.apiKey;
        finalConfig.apiSecret = globalCreds.apiSecret;
        finalConfig.fromNumber = finalConfig.fromNumber || globalCreds.fromNumber;
      }
      
      if (config.provider === 'twilio' && (!config.accountSid || !config.authToken)) {
        this.logger.log('📦 Usando credenciales globales de Twilio');
        const globalCreds = await this.systemConfigService.getTwilioCredentials();
        finalConfig.accountSid = globalCreds.accountSid;
        finalConfig.authToken = globalCreds.authToken;
        finalConfig.fromNumber = finalConfig.fromNumber || globalCreds.fromNumber;
      }
      // --- FIN DE LÓGICA GLOBAL ---

      this.validateConfig(finalConfig);
      this.validatePayload(payload);

      if (finalConfig.provider === 'vonage') {
        return await this.sendViaVonage(finalConfig, payload);
      } else if (finalConfig.provider === 'twilio') {
        return await this.sendViaTwilio(finalConfig, payload); // <--- NUEVO
      } else {
        throw new Error(`Proveedor no soportado: ${finalConfig.provider}`);
      }
    } catch (error: any) {
      this.logger.error(`❌ Error enviando SMS: ${error.message}`);
      // Relanzar el error para que el procesador lo maneje
      throw new Error(`SMS Provider Error: ${error.message}`);
    }
  }

  private async sendViaVonage(config: SMSConfig, payload: SMSContent) {
    // Reutilizar cliente si las credenciales no han cambiado
    if (!this.vonageClient || this.currentVonageKey !== config.apiKey || this.currentVonageSecret !== config.apiSecret) {
      this.vonageClient = new Vonage({
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
      });
      this.currentVonageKey = config.apiKey!;
      this.currentVonageSecret = config.apiSecret!;
    }

    const fromNumber = payload.from || config.fromNumber || 'OmniNotify';
    const toNumber = this.formatToE164(payload.to);
    
    this.logger.debug(`📤 Vonage: ${fromNumber} → ${toNumber}`);

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

  // ==================== NUEVO: ENVÍO POR TWILIO ====================
  private async sendViaTwilio(config: SMSConfig, payload: SMSContent) {
    // Reutilizar cliente de Twilio
    if (!this.twilioClient || this.currentTwilioSid !== config.accountSid || this.currentTwilioToken !== config.authToken) {
      this.twilioClient = new Twilio(config.accountSid, config.authToken);
      this.currentTwilioSid = config.accountSid!;
      this.currentTwilioToken = config.authToken!;
    }

    const fromNumber = payload.from || config.fromNumber;
    if (!fromNumber) {
      throw new Error('Número de origen (fromNumber) es requerido para Twilio');
    }
    
    const toNumber = this.formatToE164(payload.to);
    
    this.logger.debug(`📤 Twilio: ${fromNumber} → ${toNumber}`);

    try {
      const message = await this.twilioClient.messages.create({
        body: payload.text,
        from: fromNumber,
        to: toNumber,
        // statusCallback: payload.webhookUrl, // Opcional: URL para webhooks de estado
      });

      this.logger.log(`✅ Twilio Mensaje enviado. SID: ${message.sid}`);

      return {
        success: true,
        provider: 'twilio',
        messageId: message.sid,
        to: message.to,
        from: message.from,
        status: message.status,
        price: message.price,
        priceUnit: message.priceUnit,
        dateCreated: message.dateCreated,
        // Twilio no da balance en la respuesta de envío
      };
    } catch (error: any) {
      this.logger.error(`❌ Error en Twilio API: ${error.message}`);
      // Twilio lanza errores con más detalles, intenta extraerlos
      throw new Error(`Twilio API Error: ${error.message}`);
    }
  }

  // ==================== MÉTODO getBalance MEJORADO ====================
  async getBalance(config?: SMSConfig): Promise<number> {
    try {
      let finalConfig = config;
      
      // Si no se proporciona configuración, usar la global de Vonage por defecto
      if (!finalConfig) {
        try {
          const globalCreds = await this.systemConfigService.getVonageCredentials();
          finalConfig = {
            provider: 'vonage',
            apiKey: globalCreds.apiKey,
            apiSecret: globalCreds.apiSecret,
          };
          this.logger.log('📦 Usando credenciales globales de Vonage para consulta de balance');
        } catch (error) {
          throw new Error('No se pudo cargar configuración por defecto para balance');
        }
      }

      if (finalConfig.provider !== 'vonage') {
        throw new Error('La consulta de balance solo está disponible para Vonage');
      }

      if (!finalConfig.apiKey || !finalConfig.apiSecret) {
        throw new Error('Credenciales Vonage requeridas para consultar balance');
      }

      // Usar el cliente existente o crear uno nuevo
      if (!this.vonageClient || this.currentVonageKey !== finalConfig.apiKey || this.currentVonageSecret !== finalConfig.apiSecret) {
        this.vonageClient = new Vonage({
          apiKey: finalConfig.apiKey,
          apiSecret: finalConfig.apiSecret,
        });
        this.currentVonageKey = finalConfig.apiKey;
        this.currentVonageSecret = finalConfig.apiSecret;
      }

      const balance: any = await this.vonageClient.accounts.getBalance();
      
      // Lógica de extracción de balance (la misma que tenías)
      if (balance && typeof balance === 'object') {
        if (balance.value !== undefined) return Number(balance.value) || 0;
        if (balance.balance !== undefined) return Number(balance.balance) || 0;
        if (balance.amount !== undefined) return Number(balance.amount) || 0;
      }
      if (typeof balance === 'number') return balance;
      if (typeof balance === 'string') return parseFloat(balance) || 0;
      
      return 0;
    } catch (error: any) {
      this.logger.error(`Error obteniendo balance: ${error.message}`);
      throw new Error(`No se pudo obtener balance: ${error.message}`);
    }
  }

  // ==================== MÉTODOS DE VALIDACIÓN (sin cambios) ====================
  private validateConfig(config: SMSConfig): void {
    if (!config.provider) throw new Error('Proveedor SMS no especificado');

    if (config.provider === 'vonage') {
      const missingFields: string[] = [];
      if (!config.apiKey) missingFields.push('apiKey');
      if (!config.apiSecret) missingFields.push('apiSecret');
      if (missingFields.length > 0) {
        throw new Error(`Faltan campos Vonage: ${missingFields.join(', ')}`);
      }
    } else if (config.provider === 'twilio') {
      const missingFields: string[] = [];
      if (!config.accountSid) missingFields.push('accountSid');
      if (!config.authToken) missingFields.push('authToken');
      if (!config.fromNumber) missingFields.push('fromNumber');
      if (missingFields.length > 0) {
        throw new Error(`Faltan campos Twilio: ${missingFields.join(', ')}`);
      }
    }
  }

  private validatePayload(payload: SMSContent): void {
    if (!payload.to) throw new Error('Número de destino requerido');
    if (!payload.text?.trim()) throw new Error('Texto del mensaje requerido');
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
    if (cleanNumber.startsWith('+')) return cleanNumber;
    if (cleanNumber.startsWith('00')) return '+' + cleanNumber.substring(2);
    if (cleanNumber.startsWith('0')) cleanNumber = cleanNumber.substring(1);
    return '+' + defaultCountryCode + cleanNumber;
  }
}