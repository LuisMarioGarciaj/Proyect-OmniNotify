import { IsString, IsNotEmpty, MaxLength, IsUUID } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsUUID()
  company_id: string;
}