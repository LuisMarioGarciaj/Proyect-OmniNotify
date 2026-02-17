// src/modules/contacts/dto/create-contact.dto.ts
import { IsString, IsOptional, IsEmail, IsArray, IsUUID } from 'class-validator';

export class CreateContactDto {
  @IsUUID()
  company_id: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsOptional()
  metadata?: any;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  tagIds?: string[];
}