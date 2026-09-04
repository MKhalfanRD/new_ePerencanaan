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

export class AlokasiDto {
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

/**
 * 1 proyek (Planning) bisa punya banyak Paket. Field yang dulu ada di
 * Planning (RO/masa pelaksanaan/wilayah sungai) sekarang di sini — lihat
 * docs-planning/fitur-paket/01-database.md.
 */
export class PaketDto {
  @ApiPropertyOptional({ description: 'Kosongkan untuk paket baru' })
  @IsOptional()
  @IsString()
  id?: string;

  // kodePaket sengaja tidak ada di sini — digenerate otomatis di service.

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

  @ApiPropertyOptional({ type: [AlokasiDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlokasiDto)
  alokasi?: AlokasiDto[];
}

export class CreatePlanningDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  balaiId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  periodeId: number;

  // kodeProyek sengaja tidak ada di sini — digenerate otomatis di service
  // (lihat src/common/kode-generator.ts), bukan input manual.

  @ApiProperty({ example: 'Pembangunan Sumur Air Tanah' })
  @IsString()
  projectName: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  polaRencana?: string;

  // StudiLayak/DED/LARAP — angka tahun polos, sesuai DB.xlsx (lihat
  // docs-planning/audit-restrukturisasi-db-xlsx.md §3.3)
  @ApiPropertyOptional({ example: 2020 })
  @IsOptional()
  @IsInt()
  tahunStudiLayak?: number;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @IsInt()
  tahunDed?: number;

  @ApiPropertyOptional({ example: 2025 })
  @IsOptional()
  @IsInt()
  tahunLarap?: number;

  @ApiPropertyOptional({
    enum: [
      'PEMERINTAH_DAERAH',
      'KEMENTERIAN_LEMBAGA',
      'MASYARAKAT',
      'TINDAK_LANJUT_RENAKSI',
      'LAINNYA',
    ],
  })
  @IsOptional()
  @IsEnum([
    'PEMERINTAH_DAERAH',
    'KEMENTERIAN_LEMBAGA',
    'MASYARAKAT',
    'TINDAK_LANJUT_RENAKSI',
    'LAINNYA',
  ])
  sumberUsulanProyek?: string;

  @ApiPropertyOptional({ description: 'Diisi kalau sumberUsulanProyek = LAINNYA' })
  @IsOptional()
  @IsString()
  sumberUsulanLainnya?: string;

  // Relasi
  @ApiPropertyOptional({ type: [PaketDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaketDto)
  paket?: PaketDto[];
}
