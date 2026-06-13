import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KriteriaDokumenDto {
  @ApiProperty({ example: 'Dokumen Lingkungan' })
  @IsString()
  jenis: string;

  @ApiProperty({ enum: ['TIDAK_PERLU', 'BELUM_ADA', 'SUDAH_ADA'] })
  @IsEnum(['TIDAK_PERLU', 'BELUM_ADA', 'SUDAH_ADA'])
  status: string;

  @ApiPropertyOptional({ example: 2025 })
  @IsOptional()
  @IsInt()
  tahun?: number;
}

export class MajorProjectDto {
  @ApiProperty()
  @IsString()
  majorProjectId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  detail?: string;
}

export class AlokasiDto {
  @ApiProperty({ example: '005' })
  @IsString()
  roId: string;

  @ApiProperty({ example: 2025 })
  @IsInt()
  tahun: number;

  @ApiProperty({ enum: ['RENCANA', 'REALISASI'] })
  @IsEnum(['RENCANA', 'REALISASI'])
  status: string;

  @ApiPropertyOptional({ example: 1000000000 })
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

export class PrioritasDto {
  @ApiProperty({ example: 2025 })
  @IsInt()
  tahun: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  proyekPrioritas?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  proyekRPIW?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  kegiatanBaru?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  kegiatanWajib?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  proyekKonregFKS?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  proyekMusrengbangnas?: boolean;
}

export class CreatePlanningDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  balaiId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  periodeId: number;

  @ApiProperty({ example: 'Pembangunan Sumur Air Tanah' })
  @IsString()
  projectName: string;

  @ApiProperty({ enum: ['SINGLE_YEAR', 'MULTI_YEAR'] })
  @IsEnum(['SINGLE_YEAR', 'MULTI_YEAR'])
  masaPelaksanaan: string;

  @ApiPropertyOptional({ enum: ['PUSAT', 'DAERAH'], default: 'PUSAT' })
  @IsOptional()
  @IsEnum(['PUSAT', 'DAERAH'])
  kewenangan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provinceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  // Kesesuaian Proyek
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wilayahSungaiId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  kebutuhanTanah?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sesuaiRTRW?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nomorPerdaRTRW?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sesuaiPolaSDA?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nomorKepmenPUPR?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sesuaiMasterplan?: string;

  // Relasi
  @ApiPropertyOptional({ type: [KriteriaDokumenDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KriteriaDokumenDto)
  kriteriaDokumen?: KriteriaDokumenDto[];

  @ApiPropertyOptional({ type: [MajorProjectDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MajorProjectDto)
  majorProjects?: MajorProjectDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tindakLanjutIds?: string[];

  @ApiPropertyOptional({ type: [AlokasiDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlokasiDto)
  alokasi?: AlokasiDto[];

  @ApiPropertyOptional({ type: [PrioritasDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrioritasDto)
  prioritas?: PrioritasDto[];
}
