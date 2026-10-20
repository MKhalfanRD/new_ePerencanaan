import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Hasil pemeriksaan Verifikator/Operator. */
export class PeriksaDto {
  @ApiProperty({ enum: ['SESUAI', 'REVISI'] }) @IsIn(['SESUAI', 'REVISI']) hasil: 'SESUAI' | 'REVISI';
  @ApiPropertyOptional() @IsOptional() @IsString() catatan?: string;
}

/** Keputusan Admin/Super Admin. */
export class PutuskanDto {
  @ApiProperty({ enum: ['SETUJU', 'KEMBALIKAN'] })
  @IsIn(['SETUJU', 'KEMBALIKAN'])
  hasil: 'SETUJU' | 'KEMBALIKAN';
  @ApiPropertyOptional() @IsOptional() @IsString() catatan?: string;
}

export class IdsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  ids: string[];
}

export class QueryPemeriksaanDto {
  @ApiPropertyOptional({ enum: ['perlu', 'keputusan', 'selesai'] })
  @IsOptional()
  @IsIn(['perlu', 'keputusan', 'selesai'])
  tab?: 'perlu' | 'keputusan' | 'selesai';
  @ApiPropertyOptional() @IsOptional() @IsString() kegiatanId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() balaiId?: string;
}
