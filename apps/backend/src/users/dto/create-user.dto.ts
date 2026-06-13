import { IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  roleCode: string;

  @IsOptional()
  email?: string;

  @IsOptional()
  nip?: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  balaiId?: number;
}
