// src/modules/system/interfaces/system-config.interface.ts
export interface VonageCredentials {
  apiKey: string;
  apiSecret: string;
  fromNumber: string;
  isActive: boolean;
}

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string; // Número de teléfono de Twilio (ej: +14155238886)
  isActive: boolean;
}

// Puedes añadir más interfaces aquí para futuros proveedores