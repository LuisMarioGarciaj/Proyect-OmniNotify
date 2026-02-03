import type { Tag } from '../types/tag';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
});

export const tagsService = {
  // GET original: traía todo de /tags
  async getAll(): Promise<Tag[]> {
    const response = await fetch(`${API_URL}/tags`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Error fetching tags');
    return response.json();
  },

  async create(tagData: { name: string; company_id: string }): Promise<Tag> {
    const response = await fetch(`${API_URL}/tags`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(tagData),
    });
    if (!response.ok) throw new Error('Error creating tag');
    return response.json();
  },

  async update(id: string, name: string): Promise<Tag> {
    const response = await fetch(`${API_URL}/tags/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Error updating tag');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/tags/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Error deleting tag');
  },
};