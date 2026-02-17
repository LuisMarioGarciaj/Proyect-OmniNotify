export interface Tag {
  id: string;
  name: string;
  company_id: string;
  contacts_count?: number;
  contacts_preview?: ContactPreview[];
  created_at?: string;
}
export interface ContactPreview {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface CreateTagDto {
  name: string;
  company_id: string;
}