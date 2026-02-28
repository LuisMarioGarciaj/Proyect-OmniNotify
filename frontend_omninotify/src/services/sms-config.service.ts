// src/services/sms-config.service.ts
import axiosInstance from '../utils/axios.config';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface SmsGlobalConfig {
  activeProvider: 'vonage' | 'twilio';
  vonage: {
    configured: boolean;
    fromNumber: string;
    isActive: boolean;
  };
  twilio: {
    configured: boolean;
    fromNumber: string;
    isActive: boolean;
  };
}

class SmsConfigService {
  async getGlobalConfig(): Promise<SmsGlobalConfig> {
    try {
      const [vonageRes, twilioRes, activeProviderRes] = await Promise.all([
        axiosInstance.get(`${API_BASE_URL}/system/config/vonage`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
        }),
        axiosInstance.get(`${API_BASE_URL}/system/config/twilio`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
        }),
        axiosInstance.get(`${API_BASE_URL}/system/config/sms/active-provider`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
        }).catch(() => ({ data: { provider: 'vonage' } })) // Si falla, usar vonage
      ]);

      const vonageActive = vonageRes.data.success && vonageRes.data.data.isActive && vonageRes.data.data.hasSecret;
      const twilioActive = twilioRes.data.success && twilioRes.data.data.isActive && twilioRes.data.data.hasToken;

      // Obtener proveedor activo del backend
      let activeProvider: 'vonage' | 'twilio' = activeProviderRes.data?.provider || 'vonage';

      // Validar que el proveedor activo realmente esté configurado
      if (activeProvider === 'twilio' && !twilioActive) {
        activeProvider = vonageActive ? 'vonage' : 'vonage';
      }
      if (activeProvider === 'vonage' && !vonageActive) {
        activeProvider = twilioActive ? 'twilio' : 'vonage';
      }

      return {
        activeProvider,
        vonage: {
          configured: vonageActive,
          fromNumber: vonageRes.data.data?.fromNumber || 'OmniNotify',
          isActive: vonageRes.data.data?.isActive || false
        },
        twilio: {
          configured: twilioActive,
          fromNumber: twilioRes.data.data?.fromNumber || '',
          isActive: twilioRes.data.data?.isActive || false
        }
      };
    } catch (error) {
      console.error('Error obteniendo configuración SMS:', error);
      return {
        activeProvider: 'vonage',
        vonage: { configured: false, fromNumber: 'OmniNotify', isActive: false },
        twilio: { configured: false, fromNumber: '', isActive: false }
      };
    }
  }

  async setActiveProvider(provider: 'vonage' | 'twilio'): Promise<boolean> {
    try {
      // Guardar en localStorage como respaldo
      localStorage.setItem('active_sms_provider', provider);
      
      // Guardar en backend
      const response = await axiosInstance.post(
        `${API_BASE_URL}/system/config/sms/active-provider`, 
        { provider },
        { headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } }
      );
      
      return response.data.success === true;
    } catch (error) {
      console.error('Error guardando proveedor activo en backend:', error);
      return false;
    }
  }

  async getActiveProvider(): Promise<'vonage' | 'twilio'> {
    try {
      const response = await axiosInstance.get(
        `${API_BASE_URL}/system/config/sms/active-provider`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } }
      );
      return response.data.provider || 'vonage';
    } catch (error) {
      console.error('Error obteniendo proveedor activo:', error);
      return (localStorage.getItem('active_sms_provider') as 'vonage' | 'twilio') || 'vonage';
    }
  }
}

export const smsConfigService = new SmsConfigService();