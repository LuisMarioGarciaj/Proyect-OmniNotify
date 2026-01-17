import type { Contact } from '../types/contact';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function getContacts(): Promise<Contact[]> {
  const res = await fetch(`${API_URL}/contacts`, {
    headers: {
      'Content-Type': 'application/json',
      // JWT luego
    },
  });

  if (!res.ok) {
    throw new Error('Error fetching contacts');
  }

  return res.json();
}

export async function createContact(data: Partial<Contact>) {
  const res = await fetch(`${API_URL}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error('Error creating contact');
  }

  return res.json();
}

export async function updateContact(id: string, data: Partial<Contact>) {
  const res = await fetch(`${API_URL}/contacts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error('Error updating contact');
  }

  return res.json();
}

export async function deleteContact(id: string) {
  const res = await fetch(`${API_URL}/contacts/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('Error deleting contact');
  }
}
 