import type { Contact } from '../types/contact';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`, 
});

export async function getContacts(companyId: string): Promise<Contact[]> {
  const res = await fetch(`${API_URL}/contacts/company/${companyId}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Error fetching contacts');
  return res.json();
}

export async function createContact(companyId: string, data: Partial<Contact>) {
  const res = await fetch(`${API_URL}/contacts`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ...data, company_id: companyId }),
  });
  if (!res.ok) throw new Error('Error creating contact');
  return res.json();
}

export async function updateContact(id: string, data: Partial<Contact>) {
  const res = await fetch(`${API_URL}/contacts/${id}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data), 
  });
  if (!res.ok) throw new Error('Error updating contact');
  return res.json();
}

export async function deleteContact(id: string) {
  const res = await fetch(`${API_URL}/contacts/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Error deleting contact');
}