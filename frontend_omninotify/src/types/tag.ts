export interface Tag {
  id: string;
  name: string;
  company_id: string;
  contacts_count?: number;
  created_at?: string;
}

export interface CreateTagDto {
  name: string;
  company_id: string;
}