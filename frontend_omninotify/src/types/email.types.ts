// Tipos para configuración de email
export interface EmailConfig {
  provider: 'sendgrid' | 'smtp';
  apiKey?: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    fromEmail?: string;
    fromName?: string;
  };
}

export interface EmailSettings {
  id?: string;
  companyId: string;
  provider: 'sendgrid' | 'smtp';
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  fromEmail?: string;
  fromName?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TestEmailRequest {
  to: string;
  provider: 'sendgrid' | 'smtp';
  apiKey?: string;
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  metadata?: {
    companyName: string;
    companyLogo?: string;
    testType: string;
    includeLogo: boolean;
    logoSize?: number;
    logoUrl?: string;
    logoFilename?: string;
  };
}

export interface TestEmailResponse {
  success: boolean;
  message: string;
  result?: {
    provider: string;
    messageId?: string;
    statusCode?: number;
    recipient?: string;
    sender?: string;
    includesLogo?: boolean;
    companyName?: string;
    maskedFormat?: string;
    logoOptimized?: string;
    logoSizeKB?: number;
  };
  error?: string;
}

export interface EmailStats {
  totalEmails: number;
  sentEmails: number;
  failedEmails: number;
  successRate: string;
}

export interface EmailHealth {
  status: string;
  service: string;
  timestamp: string;
  features: string[];
  limits?: {
    bodySize: string;
    fileUpload: string;
    logoBase64: string;
    optimizedLogo: string;
  };
  endpoints?: Record<string, string>;
}