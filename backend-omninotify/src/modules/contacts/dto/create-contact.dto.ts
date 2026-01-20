import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
} from 'class-validator';

export class CreateContactDto {
  @IsUUID()
  company_id: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsArray()
  tagIds?: string[];
}
