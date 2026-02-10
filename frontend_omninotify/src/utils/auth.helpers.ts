// src/utils/auth.helpers.ts
// Funciones centralizadas para obtener datos del usuario desde localStorage
export function getUser() {
  const raw = localStorage.getItem('user_data');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      id: string;
      email: string;
      name: string;
      role: string;
      company_id: string;
    };
  } catch {
    return null;
  }
}

export function getCompanyId(): string | null {
  return getUser()?.company_id ?? null;
}

export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}