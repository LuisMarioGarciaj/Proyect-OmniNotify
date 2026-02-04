const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Función helper para obtener headers con JWT
function getAuthHeaders() {
  const token = localStorage.getItem('auth_token');
  
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function getCompany(id: string) {
  const res = await fetch(`${API_URL}/companies/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    // Si es 404, lanzamos un error específico
    if (res.status === 404) {
      throw new Error('Company not found (404)');
    }
    throw new Error('Error fetching company data');
  }

  return res.json();
}

export async function updateCompany(id: string, data: { name?: string; logo?: string }) {
  const res = await fetch(`${API_URL}/companies/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error('Error updating company');
  }

  return res.json();
}