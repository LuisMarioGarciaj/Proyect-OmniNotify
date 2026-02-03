const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function getCompany(id: string) {
  const res = await fetch(`${API_URL}/companies/${id}`, {
    headers: {
      'Content-Type': 'application/json',
      // JWT luego
    },
  });

  if (!res.ok) {
    throw new Error('Error fetching company data');
  }

  return res.json();
}

export async function updateCompany(id: string, data: { name?: string; logo?: string }) {
  const res = await fetch(`${API_URL}/companies/${id}`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error('Error updating company');
  }

  return res.json();
}