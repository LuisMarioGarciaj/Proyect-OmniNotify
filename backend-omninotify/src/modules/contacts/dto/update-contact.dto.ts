import { IsOptional, IsArray, IsString } from 'class-validator';

export class UpdateContactDto {
  name?: string;
  email?: string;
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}
