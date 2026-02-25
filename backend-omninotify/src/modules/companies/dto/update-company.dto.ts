import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { CompanyStatus } from '../entities/company.entity';

export class UpdateCompanyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(CompanyStatus)
  @IsOptional()
  status?: CompanyStatus;

  @IsString()
  @IsOptional()
  logo?: string; // Aquí recibiremos el string Base64 del Front

  @IsObject()
  @IsOptional()
  api_keys_config?: Record<string, any>;
}