import {
  IsOptional,
  IsString,
  MinLength,
  IsIn,
  IsNumber,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  nip?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  roleCode?: string;

  @IsOptional()
  @IsNumber()
  balaiId?: number;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

export class SetUserStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status: 'ACTIVE' | 'INACTIVE';
}
