import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kegiatanPrioritasId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tahunDed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tahunDokumenLingkungan?: number;

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
  tematikRenjaId?: string;

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
}
