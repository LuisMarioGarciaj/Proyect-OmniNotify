// src/services/template.service.ts

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Template {
  id: string;
  name: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  content: string;
  company_id: string;
  provider_template_id?: string;
}

export async function getTemplates(companyId: string): Promise<Template[]> {
  const res = await fetch(`${API_URL}/api/templates/company/${companyId}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error('Error fetching templates');
  }

  const data = await res.json();

  // Soporta si el backend retorna { data: [...] } o directamente [...]
  return Array.isArray(data) ? data : data.data ?? [];
}

export async function createTemplate(companyId: string, payload: {
  name: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  content: string;
}): Promise<Template> {
  const res = await fetch(`${API_URL}/api/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      companyId, // o company_id, según como espere tu backend
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Error creating template');
  }

  return res.json();
}

export async function updateTemplate(templateId: string, payload: {
  name: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  content: string;
  companyId: string;
}): Promise<Template> {
  const res = await fetch(`${API_URL}/api/templates/${templateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Error updating template');
  }

  return res.json();
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/templates/${templateId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('Error deleting template');
  }
}