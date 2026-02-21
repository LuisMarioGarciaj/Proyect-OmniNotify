// src/services/credits.service.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Interfaces
export interface CreditsPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  popular?: boolean;
  description?: string;
}

export interface RechargeRequest {
  company_id: string;
  package_id: string;
  payment_method?: string;
}

// Objeto de servicio con métodos
export const creditsService = {
  // Obtener créditos de una empresa
  async getCompanyCredits(companyId: string): Promise<number> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/credits/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener créditos');
      }
      
      const data = await response.json();
      return data.credits;
    } catch (error) {
      console.error('Error getting credits:', error);
      // Si no hay backend aún, retornar datos mock
      return this.getMockCredits(companyId);
    }
  },

  // Método mock para desarrollo (simula datos del backend)
  getMockCredits(companyId: string): number {
    // Simular créditos basados en companyId para consistencia
    const mockCredits: Record<string, number> = {
      'default': 150,
      'company_1': 500,
      'company_2': 1200,
      'company_3': 75,
    };
    
    // Usar créditos guardados en localStorage si existen
    const savedCredits = localStorage.getItem(`credits_${companyId}`);
    if (savedCredits) {
      return parseInt(savedCredits);
    }
    
    // O retornar créditos mock
    return mockCredits[companyId] || mockCredits.default;
  },

  // Obtener paquetes de créditos disponibles
  async getCreditsPackages(): Promise<CreditsPackage[]> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/credits/packages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener paquetes');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting packages:', error);
      // Paquetes mock para desarrollo
      return [
        { id: '1', name: 'Básico', credits: 100, price: 10, description: 'Para empezar' },
        { id: '2', name: 'Profesional', credits: 500, price: 45, description: 'Para negocios en crecimiento', popular: true },
        { id: '3', name: 'Empresarial', credits: 2000, price: 160, description: 'Para grandes volúmenes' },
        { id: '4', name: 'Personalizado', credits: 5000, price: 350, description: 'Contacta con ventas' },
      ];
    }
  },

  // Realizar recarga de créditos
  async rechargeCredits(data: RechargeRequest): Promise<{ success: boolean; credits: number }> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/credits/recharge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Error al recargar créditos');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error recharging credits:', error);
      // Simular recarga exitosa para desarrollo
      const packageCredits = this.getPackageCredits(data.package_id);
      const currentCredits = this.getMockCredits(data.company_id);
      const newCredits = currentCredits + packageCredits;
      
      // Guardar en localStorage
      localStorage.setItem(`credits_${data.company_id}`, newCredits.toString());
      
      return { success: true, credits: newCredits };
    }
  },

  // Helper para obtener créditos de un paquete
  getPackageCredits(packageId: string): number {
    const packages: Record<string, number> = {
      '1': 100,
      '2': 500,
      '3': 2000,
      '4': 5000,
    };
    return packages[packageId] || 0;
  },

  // Guardar créditos en localStorage (útil para desarrollo)
  saveCredits(companyId: string, credits: number) {
    localStorage.setItem(`credits_${companyId}`, credits.toString());
  }
};