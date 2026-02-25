import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import twilio = require('twilio');

export interface WhatsAppMessageResponse {
  messageSid: string;
  status: string;
  to: string;
  body: string;
  mediaUrl?: string;
  timestamp: string;
  provider: string;
}

export interface WhatsAppMessageStatus {
  messageSid: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'undelivered';
  to: string;
  from: string;
  errorCode?: string;
  errorMessage?: string;
}

@Injectable()
export class WhatsappProvider {
  private readonly logger = new Logger(WhatsappProvider.name);
  private twilio_client: any;
  private fromNumber: string;
  private isEnabled: boolean;

  constructor() {
    this.initializeTwilio();
  }

  /**
   * Inicializa el cliente de Twilio
   */
  private initializeTwilio(): void {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      this.fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155552671';
      this.isEnabled = process.env.TWILIO_WHATSAPP_ENABLED === 'true';

      if (!accountSid || !authToken) {
        this.logger.warn('⚠️ Credenciales de Twilio no configuradas');
        this.isEnabled = false;
        return;
      }

      this.twilio_client = twilio(accountSid, authToken);
      this.logger.log('✅ Cliente de Twilio inicializado correctamente');
      this.logger.log(`📱 WhatsApp FROM: ${this.fromNumber}`);
    } catch (error: any) {
      this.logger.error('❌ Error inicializando Twilio:', error.message);
      this.isEnabled = false;
    }
  }

  /**
   * Envía un mensaje de texto simple por WhatsApp
   */
  async sendMessage(
    to: string,
    body: string,
    metadata?: Record<string, any>
  ): Promise<WhatsAppMessageResponse> {
    try {
      this.logger.log(`📤 Enviando mensaje WhatsApp a ${to}`);

      // Validaciones
      this.validatePhoneNumber(to);
      this.validateMessageBody(body);

      if (!this.isEnabled || !this.twilio_client) {
        throw new BadRequestException(
          'Servicio de WhatsApp no configurado. Verifica variables de entorno.'
        );
      }

      // Formatear número a E.164
      const formattedTo = this.formatPhoneNumber(to);

      // Enviar mensaje
      const message = await this.twilio_client.messages.create({
        from: this.fromNumber,
        to: `whatsapp:${formattedTo}`,
        body: body,
        // Campos adicionales para tracking
        ...(metadata && {
          statusCallback: metadata.webhookUrl || process.env.TWILIO_WEBHOOK_URL,
          statusCallbackMethod: 'POST',
        }),
      });

      this.logger.log(`✅ Mensaje enviado exitosamente. SID: ${message.sid}`);

      return {
        messageSid: message.sid,
        status: message.status,
        to: formattedTo,
        body: body,
        timestamp: new Date().toISOString(),
        provider: 'twilio',
      };
    } catch (error: any) {
      this.logger.error('❌ Error enviando mensaje:', error);
      this.handleTwilioError(error);
      throw error;
    }
  }

  /**
   * Envía un mensaje con media (imagen, documento, etc)
   */
  async sendMediaMessage(
    to: string,
    body: string,
    mediaUrl: string,
    mediaType?: string
  ): Promise<WhatsAppMessageResponse> {
    try {
      this.logger.log(`📤 Enviando mensaje con media a ${to}`);

      // Validaciones
      this.validatePhoneNumber(to);
      this.validateMessageBody(body);
      this.validateMediaUrl(mediaUrl);

      if (!this.isEnabled || !this.twilio_client) {
        throw new BadRequestException('Servicio de WhatsApp no configurado');
      }

      const formattedTo = this.formatPhoneNumber(to);

      // Determinar tipo de media
      const contentType = this.getContentType(mediaUrl, mediaType);

      const message = await this.twilio_client.messages.create({
        from: this.fromNumber,
        to: `whatsapp:${formattedTo}`,
        body: body,
        mediaUrl: [mediaUrl], // Array de URLs
        statusCallback: process.env.TWILIO_WEBHOOK_URL,
        statusCallbackMethod: 'POST',
      });

      this.logger.log(`✅ Mensaje con media enviado. SID: ${message.sid}`);

      return {
        messageSid: message.sid,
        status: message.status,
        to: formattedTo,
        body: body,
        mediaUrl: mediaUrl,
        timestamp: new Date().toISOString(),
        provider: 'twilio',
      };
    } catch (error: any) {
      this.logger.error('❌ Error enviando media:', error);
      this.handleTwilioError(error);
      throw error;
    }
  }

  /**
   * Envía un mensaje usando template (si está disponible)
   */
  async sendTemplate(
    to: string,
    templateName: string,
    variables?: Record<string, string>
  ): Promise<WhatsAppMessageResponse> {
    try {
      this.logger.log(`📤 Enviando template "${templateName}" a ${to}`);

      this.validatePhoneNumber(to);

      if (!this.isEnabled || !this.twilio_client) {
        throw new BadRequestException('Servicio de WhatsApp no configurado');
      }

      const formattedTo = this.formatPhoneNumber(to);

      // Construir body del template
      let body = this.buildTemplateMessage(templateName, variables);

      const message = await this.twilio_client.messages.create({
        from: this.fromNumber,
        to: `whatsapp:${formattedTo}`,
        body: body,
        statusCallback: process.env.TWILIO_WEBHOOK_URL,
        statusCallbackMethod: 'POST',
      });

      this.logger.log(`✅ Template enviado. SID: ${message.sid}`);

      return {
        messageSid: message.sid,
        status: message.status,
        to: formattedTo,
        body: body,
        timestamp: new Date().toISOString(),
        provider: 'twilio',
      };
    } catch (error: any) {
      this.logger.error('❌ Error enviando template:', error);
      throw error;
    }
  }

  /**
   * Obtiene el estado de un mensaje
   */
  async getMessageStatus(messageSid: string): Promise<WhatsAppMessageStatus> {
    try {
      if (!this.isEnabled || !this.twilio_client) {
        throw new BadRequestException('Servicio no configurado');
      }

      const message = await this.twilio_client.messages(messageSid).fetch();

      return {
        messageSid: message.sid,
        status: message.status as any,
        to: message.to,
        from: message.from,
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error obteniendo estado del mensaje ${messageSid}:`, error);
      throw error;
    }
  }

  /**
   * Valida que el número de teléfono esté en formato correcto
   */
  private validatePhoneNumber(phoneNumber: string): void {
    if (!phoneNumber) {
      throw new BadRequestException('El número de teléfono es requerido');
    }

    // Remover espacios y caracteres especiales excepto +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // Debe empezar con + o tener al menos 10 dígitos
    if (!cleaned.startsWith('+') && cleaned.length < 10) {
      throw new BadRequestException(
        'Número de teléfono inválido. Use formato E.164: +54911XXXXXXXX'
      );
    }

    // Máximo 15 dígitos (estándar E.164)
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length > 15) {
      throw new BadRequestException('Número de teléfono demasiado largo (máx 15 dígitos)');
    }
  }

  /**
   * Valida el cuerpo del mensaje
   */
  private validateMessageBody(body: string): void {
    if (!body || body.trim().length === 0) {
      throw new BadRequestException('El cuerpo del mensaje no puede estar vacío');
    }

    // WhatsApp permite hasta 1600 caracteres por mensaje
    if (body.length > 1600) {
      throw new BadRequestException('Mensaje demasiado largo (máximo 1600 caracteres)');
    }
  }

  /**
   * Valida la URL de media
   */
  private validateMediaUrl(mediaUrl: string): void {
    if (!mediaUrl) {
      throw new BadRequestException('URL de media es requerida');
    }

    try {
      new URL(mediaUrl);
    } catch (error) {
      throw new BadRequestException('URL de media inválida');
    }

    // Validar tipo de archivo permitido
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.mp3', '.mp4', '.ogg', '.webp'];
    const hasValidExtension = allowedExtensions.some(ext =>
      mediaUrl.toLowerCase().includes(ext)
    );

    if (!hasValidExtension) {
      throw new BadRequestException(
        'Tipo de archivo no soportado. Usa: JPG, PNG, PDF, MP3, MP4, OGG, WEBP'
      );
    }
  }

  /**
   * Formatea el número de teléfono a E.164
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Ya está en formato E.164
    if (phoneNumber.startsWith('+')) {
      return phoneNumber;
    }

    // Si comienza con 0, removerlo (ej: Argentina)
    let cleaned = phoneNumber.replace(/[^\d]/g, '');

    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // Asumir código de país basado en longitud o variable de entorno
    const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || '54'; // Argentina por defecto

    // Si no tiene código de país, agregarlo
    if (cleaned.length === 10 || cleaned.length === 11) {
      // Argentina (11 dígitos con área)
      return `+${defaultCountryCode}${cleaned}`;
    } else if (cleaned.startsWith(defaultCountryCode)) {
      return `+${cleaned}`;
    }

    // Asumir que ya está bien formateado
    return `+${cleaned}`;
  }

  /**
   * Obtiene el Content-Type basado en la URL
   */
  private getContentType(mediaUrl: string, mediaType?: string): string {
    if (mediaType) return mediaType;

    const url = mediaUrl.toLowerCase();

    if (url.includes('.jpg') || url.includes('.jpeg')) return 'image/jpeg';
    if (url.includes('.png')) return 'image/png';
    if (url.includes('.gif')) return 'image/gif';
    if (url.includes('.pdf')) return 'application/pdf';
    if (url.includes('.mp3')) return 'audio/mpeg';
    if (url.includes('.mp4')) return 'video/mp4';
    if (url.includes('.ogg')) return 'audio/ogg';
    if (url.includes('.webp')) return 'image/webp';

    return 'application/octet-stream';
  }

  /**
   * Construye el mensaje de template
   */
  private buildTemplateMessage(templateName: string, variables?: Record<string, string>): string {
    const templates: Record<string, string> = {
      'welcome': `¡Bienvenido a {{companyName}}! 🎉\n\nGracias por registrarte. Si tienes preguntas, estamos aquí para ayudarte.`,
      'verification-code': `Tu código de verificación es: {{code}}\n\nNo compartas este código con nadie.`,
      'order-confirmation': `Pedido confirmado! 📦\n\nNúmero de pedido: {{orderNumber}}\nTotal: {{total}}\n\nTracking: {{trackingUrl}}`,
      'password-reset': `Para resetear tu contraseña, haz clic aquí: {{resetLink}}\n\nEste link expira en {{expiryTime}} minutos.`,
      'notification': `{{message}}\n\nFecha: {{timestamp}}\nEstado: {{status}}`,
    };

    let message = templates[templateName] || templates['notification'];

    // Reemplazar variables
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        message = message.replace(`{{${key}}}`, value);
      });
    }

    return message;
  }

  /**
   * Maneja errores específicos de Twilio
   */
  private handleTwilioError(error: any): void {
    const errorCode = error.code;
    const errorMessage = error.message;

    const errorMap: Record<string, string> = {
      '21211': 'Número de teléfono inválido',
      '21408': 'Permiso denegado. Verifica credenciales de Twilio',
      '21606': 'El número no soporta WhatsApp',
      '20003': 'Cuerpo de mensaje inválido',
      '21614': 'Número de destino no verificado (sandbox)',
      '20429': 'Rate limit excedido. Intenta más tarde',
    };

    const friendlyError = errorMap[errorCode] || errorMessage;

    this.logger.error(`Código Twilio ${errorCode}: ${friendlyError}`);
  }

  /**
   * Verifica que el servicio esté disponible
   */
  isAvailable(): boolean {
    return this.isEnabled && !!this.twilio_client;
  }

  /**
   * Obtiene información del proveedor
   */
  getProviderInfo(): Record<string, any> {
    return {
      name: 'twilio',
      type: 'whatsapp',
      enabled: this.isEnabled,
      fromNumber: this.fromNumber,
      features: [
        'send-text',
        'send-media',
        'send-template',
        'get-status',
        'webhooks',
      ],
      limits: {
        maxCharacters: 1600,
        maxMediaSize: '16MB',
        rateLimit: '1000 messages/minute',
      },
      supportedMediaTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'audio/mpeg',
        'audio/ogg',
        'video/mp4',
      ],
    };
  }
}
