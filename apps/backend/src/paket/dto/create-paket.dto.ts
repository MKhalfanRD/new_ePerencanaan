import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaketDto {
  @ApiProperty()
  @IsString()
  planningId: string;

  // kodePaket sengaja tidak ada di sini — digenerate otomatis di service
  // (lihat src/common/kode-generator.ts), bukan input manual.

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ example: '005' })
  @IsString()
  roId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  komponenId?: string;

  @ApiProperty({ enum: ['FISIK', 'NON_FISIK'] })
  @IsEnum(['FISIK', 'NON_FISIK'])
  jenis: string;

  @ApiProperty({ enum: ['SINGLE_YEAR', 'MULTI_YEAR'] })
  @IsEnum(['SINGLE_YEAR', 'MULTI_YEAR'])
  masaPelaksanaan: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wilayahSungaiId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dokLingStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  catatanPembina?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  catatanSspsda?: string;

  // Indikator RENJA — semuanya FK ke master data, dikonfirmasi dari
  // referensi 1.xlsx (lihat docs-planning/fitur-paket/04-rekonsiliasi-referensi.md)
  @ApiPropertyOptional() @IsOptional() @IsString() kegiatanPrioritasId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pkpnId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() indikatorSasaranProgramId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() indikatorSasaranKegiatanId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() indikatorRoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tematikRenjaId?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() fkb?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() fkw?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mpa?: boolean;
}
