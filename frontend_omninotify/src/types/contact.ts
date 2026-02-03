export interface Tag {
  id: string;
  name: string;
}

export interface Contact {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  tags?: Tag[];       
  tag_ids?: string[]; 
  created_at: string;
}