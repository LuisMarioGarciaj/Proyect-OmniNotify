import type {
  EmailSettings,
  TestEmailRequest,
  TestEmailResponse,
  EmailStats,
  EmailHealth,
} from '../types/email.types';

const API_URL = 'http://localhost:3000/api';

// Helper para hacer peticiones fetch
const fetchAPI = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token');
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error en fetchAPI:', error);
    throw error;
  }
};

export const emailService = {
  // Obtener configuración de email de la empresa
  getEmailSettings: async (companyId: string): Promise<EmailSettings | null> => {
    try {
      const savedSettings = localStorage.getItem(`email_settings_${companyId}`);
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
      
      // Configuración por defecto
      return {
        companyId,
        provider: 'smtp',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        fromEmail: 'noreply@company.com',
        fromName: 'Company Notifications',
        isActive: false,
      };
    } catch (error) {
      console.error('Error obteniendo configuración de email:', error);
      return null;
    }
  },

  // Guardar configuración de email
  saveEmailSettings: async (settings: EmailSettings): Promise<boolean> => {
    try {
      // Guardar en localStorage temporalmente
      localStorage.setItem(`email_settings_${settings.companyId}`, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Error guardando configuración de email:', error);
      return false;
    }
  },

  // Probar conexión de email
  testEmailConnection: async (data: TestEmailRequest): Promise<TestEmailResponse> => {
    try {
      const response = await fetchAPI('/email/test', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    } catch (error: any) {
      return {
        success: false,
        message: 'Error probando conexión de email',
        error: error.message,
      };
    }
  },

  // Enviar email de prueba
  sendTestEmail: async (companyId: string, to: string, templateId?: string): Promise<any> => {
    try {
      const response = await fetchAPI('/email/send', {
        method: 'POST',
        body: JSON.stringify({
          companyId,
          channel: 'EMAIL',
          recipient: to,
          templateId: templateId || 'test-template',
          variables: {
            nombre: 'Usuario de Prueba',
            fecha: new Date().toLocaleDateString(),
          },
        }),
      });
      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Error enviando email de prueba');
    }
  },

  // Obtener estadísticas de email
  getEmailStats: async (companyId: string): Promise<EmailStats> => {
    try {
      const response = await fetchAPI(`/email/stats/${companyId}`);
      return response;
    } catch (error: any) {
      console.error('Error obteniendo estadísticas de email:', error);
      // Retornar datos por defecto
      return {
        totalEmails: 0,
        sentEmails: 0,
        failedEmails: 0,
        successRate: '0%',
      };
    }
  },

  // Verificar salud del servicio de email
  checkEmailHealth: async (): Promise<EmailHealth> => {
    try {
      const response = await fetchAPI('/email/health');
      return response;
    } catch (error: any) {
      return {
        status: 'unhealthy',
        service: 'email',
        timestamp: new Date().toISOString(),
        features: [],
      };
    }
  },

  // Obtener proveedores de email disponibles
  getAvailableProviders: () => {
    return [
      { value: 'smtp', label: 'SMTP (Gmail, Outlook, etc.)', icon: '📧' },
      { value: 'sendgrid', label: 'SendGrid', icon: '⚡' },
    ];
  },
};