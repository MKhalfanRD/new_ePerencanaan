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
import { FormValueDto } from './preview-skor.dto';

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
 * 1 Proyek bisa punya banyak Paket. Field tagging (PKPN/ISP/ISK/Tematik/
 * fkb/fkw/mpa/catatan) sudah pindah ke Proyek (1 proyek = 1 set tagging) —
 * lihat CreateProyekDto. Sisa di sini murni identitas & alokasi paket.
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
  dokLingStatus?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() indikatorRoId?: string;

  @ApiPropertyOptional({ type: [AlokasiDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlokasiDto)
  alokasi?: AlokasiDto[];
}

export class CreateProyekDto {
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

  // Kesesuaian Proyek — cuma wilayah sungai & kebutuhan tanah.
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  kebutuhanTanah?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wilayahSungaiId?: string;

  // PN.PP.KP — pindah dari Paket ke Proyek (1 proyek = 1 KP).
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kegiatanPrioritasId?: string;

  // StudiLayak/DED/LARAP — angka tahun polos, sesuai DB.xlsx (lihat
  // docs-planning/audit-restrukturisasi-db-xlsx.md §3.3). status* = kesiapan
  // dokumen (Rencana/Sudah Ada/Tidak Perlu), dipasangkan dengan tahunnya.
  @ApiPropertyOptional({ example: 2020 })
  @IsOptional()
  @IsInt()
  tahunStudiLayak?: number;

  @ApiPropertyOptional({ enum: ['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'] })
  @IsOptional()
  @IsEnum(['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'])
  statusStudiLayak?: string;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @IsInt()
  tahunDed?: number;

  @ApiPropertyOptional({ enum: ['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'] })
  @IsOptional()
  @IsEnum(['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'])
  statusDed?: string;

  @ApiPropertyOptional({ example: 2025 })
  @IsOptional()
  @IsInt()
  tahunLarap?: number;

  @ApiPropertyOptional({ enum: ['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'] })
  @IsOptional()
  @IsEnum(['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'])
  statusLarap?: string;

  @ApiPropertyOptional({ example: 2023 })
  @IsOptional()
  @IsInt()
  tahunDokumenLingkungan?: number;

  @ApiPropertyOptional({ enum: ['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'] })
  @IsOptional()
  @IsEnum(['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'])
  statusDokumenLingkungan?: string;

  @ApiPropertyOptional({
    description: 'Nama dari master data Sumber Usulan Proyek',
  })
  @IsOptional()
  @IsString()
  sumberUsulanProyek?: string;

  @ApiPropertyOptional({
    description: 'Diisi kalau sumberUsulanProyek = LAINNYA',
  })
  @IsOptional()
  @IsString()
  sumberUsulanLainnya?: string;

  @ApiPropertyOptional({ description: 'Justifikasi/alasan pelaksanaan proyek' })
  @IsOptional()
  @IsString()
  justifikasiProyek?: string;

  // === TAGGING === (RENSTRA/RENJA/tagging dinamis) — 1 proyek = 1 set
  // tagging. Skor evaluasi TIDAK diterima dari client sama sekali —
  // dideteksi otomatis dari field-field ini + Kriteria Teknis di service
  // (lihat evaluasi-deteksi.ts), bukan checklist manual seperti sebelumnya.
  @ApiPropertyOptional() @IsOptional() @IsString() pkpnId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  indikatorSasaranProgramId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  indikatorSasaranKegiatanId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tematikRenjaId?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() fkb?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() fkw?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mpa?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Tagging Dinamis — tag bebas',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taggingDinamis?: string[];

  // === DOKUMEN & CATATAN ===
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  catatanPembina?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  catatanSspsda?: string;

  // Relasi
  @ApiPropertyOptional({ type: [PaketDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaketDto)
  paket?: PaketDto[];

  // Isian tab Valuasi/Kinerja & "Kategori Proyek" — item yang tidak
  // dibackup kolom Proyek tetap, lihat FormValueDto.
  @ApiPropertyOptional({ type: [FormValueDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormValueDto)
  formValues?: FormValueDto[];
}
