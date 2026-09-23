import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 1 baris isian utk FormItem yang TIDAK dibackup kolom Proyek tetap (tab
 * Valuasi/Kinerja & item "Kategori Proyek") — dicocokkan by `key`
 * (FormItem.key), bukan id, supaya tetap valid lintas kegiatan/clone
 * template. `value` string = value opsi terpilih (dropdown) ATAU
 * boolean/angka utk item tanpa opsi (checkbox/fieldbox). `note` = teks
 * tambahan opsional (kolom "fieldbox" di sheet, mis. justifikasi kinerja).
 */
export class FormValueDto {
  @ApiProperty() @IsString() key: string;

  @ApiPropertyOptional()
  @IsOptional()
  value?: string | number | boolean | null;

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

/**
 * Body untuk POST /proyek/preview-skor — hitung skor evaluasi tanpa
 * menyimpan apa pun, dipakai form Proyek supaya tab Evaluasi ter-update
 * live selagi user mengisi tab lain (lihat evaluasi-deteksi.ts).
 */
export class PreviewSkorDto {
  @ApiProperty({
    description: 'RO paket pertama — dipakai menentukan kegiatan',
  })
  @IsString()
  roId: string;

  @ApiPropertyOptional({ description: 'Nama dari master data Sumber Usulan Proyek' })
  @IsOptional()
  @IsString()
  sumberUsulanProyek?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kegiatanPrioritasId?: string;

  @ApiPropertyOptional({ enum: ['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'] })
  @IsOptional()
  @IsEnum(['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'])
  statusStudiLayak?: string;

  @ApiPropertyOptional({ enum: ['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'] })
  @IsOptional()
  @IsEnum(['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'])
  statusDed?: string;

  @ApiPropertyOptional({ enum: ['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'] })
  @IsOptional()
  @IsEnum(['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'])
  statusLarap?: string;

  @ApiPropertyOptional({ enum: ['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'] })
  @IsOptional()
  @IsEnum(['RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU'])
  statusDokumenLingkungan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  kebutuhanTanah?: boolean;

  @ApiPropertyOptional({ enum: ['PUSAT', 'DAERAH'] })
  @IsOptional()
  @IsEnum(['PUSAT', 'DAERAH'])
  kewenangan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pkpnId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  indikatorSasaranProgramId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  indikatorSasaranKegiatanId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tematikRenjaId?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() fkb?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() fkw?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mpa?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taggingDinamis?: string[];

  // Dana/output/outcome paket pertama — dipakai rasio Valuasi. Opsional,
  // kalau kosong item Valuasi tidak pernah tercentang (aman, bukan error).
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalDana?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  outputTarget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  outcomeTarget?: number;

  @ApiPropertyOptional({ type: [FormValueDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormValueDto)
  formValues?: FormValueDto[];

  // Proyek yang sedang diedit — dipakai supaya field UPLOAD yang sudah
  // terupload ikut kehitung "terisi" di preview live (lihat DokumenPendukung
  // di hitungEvaluasi). Kosong saat bikin proyek baru.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proyekId?: string;
}
