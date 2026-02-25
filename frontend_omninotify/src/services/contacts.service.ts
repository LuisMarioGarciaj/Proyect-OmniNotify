import type { Contact } from '../types/contact';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
});

// ─── Custom HTTP error so callers can inspect status + message ────────────────
export class HttpError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

async function handleResponse(res: Response) {
  if (res.ok) return res.json();

  // Try to parse a JSON error body from NestJS ({ message, statusCode })
  let message = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (body?.message) {
      message = Array.isArray(body.message)
        ? body.message.join(', ')
        : body.message;
    }
  } catch {
    // ignore if body isn't JSON
  }

  throw new HttpError(res.status, message);
}

// ─── Service calls ────────────────────────────────────────────────────────────

export async function getContacts(companyId: string): Promise<Contact[]> {
  const res = await fetch(`${API_URL}/contacts/company/${companyId}`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function createContact(
  companyId: string,
  data: Partial<Contact> & { tagIds?: string[] },
) {
  const res = await fetch(`${API_URL}/contacts`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ...data, company_id: companyId }),
  });
  return handleResponse(res);
}

export async function updateContact(
  id: string,
  data: Partial<Contact> & { tagIds?: string[] },
) {
  const res = await fetch(`${API_URL}/contacts/${id}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteContact(id: string) {
  const res = await fetch(`${API_URL}/contacts/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new HttpError(res.status, `Error deleting contact (${res.status})`);
  }
}