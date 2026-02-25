// src/services/company.service.ts (FRONTEND)
import { api } from './api';

export const getCompany = async (companyId: string) => {
  try {
    // Obtener el user_data del localStorage
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    
    // Usar el company_id del user_data en lugar del parámetro
    const idToUse = userData.company_id || companyId;
    
    console.log('🔍 Obteniendo compañía con ID:', idToUse);
    console.log('👤 Usuario:', userData);
    
    const response = await api.get(`/companies/${idToUse}`);
    return response;
  } catch (error) {
    console.error('Error obteniendo compañía:', error);
    throw error;
  }
};

export const updateCompany = async (companyId: string, data: any) => {
  try {
    // Obtener el user_data del localStorage
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    
    // Usar el company_id del user_data en lugar del parámetro
    const idToUse = userData.company_id || companyId;
    
    console.log('🔍 Actualizando compañía con ID:', idToUse);
    
    const response = await api.patch(`/companies/${idToUse}`, data);
    return response;
  } catch (error) {
    console.error('Error actualizando compañía:', error);
    throw error;
  }
};