import { IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAlokasiDto {
  @ApiProperty()
  @IsString()
  planningId: string;

  @ApiProperty()
  @IsString()
  roId: string;

  @ApiProperty()
  @IsInt()
  tahun: number;

  @ApiProperty({ enum: ['RENCANA', 'REALISASI'] })
  @IsEnum(['RENCANA', 'REALISASI'])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  rm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  rmp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pln?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sbsn?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  kpbu?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  outputTarget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outputUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  outcomeTarget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcomeUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  catatan?: string;
}

export class UpdateAlokasiDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() rm?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() rmp?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() pln?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sbsn?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() kpbu?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() outputTarget?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() outputUnit?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() outcomeTarget?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() outcomeUnit?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() catatan?: string;
}

export class CreateLokasiDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() provinceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() longitude?: number;
}
