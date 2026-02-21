// src/types/index.ts (crea este archivo)
export interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id: string;
  credits?: number; // Agregar créditos
  company_name?: string;
}

export interface CreditsData {
  company_id: string;
  credits: number;
  last_updated?: string;
}