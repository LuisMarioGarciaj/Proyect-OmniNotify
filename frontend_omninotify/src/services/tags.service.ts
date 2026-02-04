import type { Tag } from '../types/tag';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token');

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const tagsService = {
  async getAll() {
    const res = await fetch(`${API_URL}/tags`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error('Error fetching tags');
    }

    return res.json();
  },

  async create(data: any) {
    const res = await fetch(`${API_URL}/tags`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error('Error creating tag');
    }

    return res.json();
  },

  async update(id: string, name: string) {
    const res = await fetch(`${API_URL}/tags/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      throw new Error('Error updating tag');
    }

    return res.json();
  },

  async delete(id: string) {
    const res = await fetch(`${API_URL}/tags/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error('Error deleting tag');
    }
  },
};
