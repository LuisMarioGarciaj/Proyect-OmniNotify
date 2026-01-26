import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @IsOptional()
  api_keys_config?: Record<string, any>;
}

export class UpdateCompanyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  api_keys_config?: Record<string, any>;
}