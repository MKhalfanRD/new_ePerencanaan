import {
  IsArray,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsInt,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BalaiResolutionDto {
  @ApiProperty({ description: 'Nama balai sebagaimana tertulis di file Excel' })
  @IsString()
  excelName: string;

  @ApiPropertyOptional({
    description:
      'ID balai yang sudah ada di sistem, jika dipilih untuk dipakai',
  })
  @IsOptional()
  @IsNumber()
  useExistingBalaiId?: number;

  @ApiPropertyOptional({
    description: 'Jika true, buat balai baru dengan ID & nama dari Excel',
  })
  @IsOptional()
  @IsBoolean()
  createNew?: boolean;
}

export class PlanningResolutionDto {
  @ApiProperty({ description: 'KodeProyek (atau key fallback) dari Excel' })
  @IsString()
  groupKey: string;

  @ApiProperty({
    enum: ['skip', 'replace'],
    description:
      'skip = pakai data lama, replace = ganti paket & alokasinya dengan data Excel baru',
  })
  @IsIn(['skip', 'replace'])
  action: 'skip' | 'replace';
}

export class CommitImportDto {
  @ApiProperty({ description: 'Token sesi import dari hasil preview' })
  @IsString()
  sessionId: string;

  @ApiProperty({ type: [BalaiResolutionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BalaiResolutionDto)
  balaiResolutions: BalaiResolutionDto[];

  @ApiPropertyOptional({
    type: [PlanningResolutionDto],
    description:
      'Keputusan untuk proyek yang sudah ada (skip/replace). Default: skip semua jika tidak dikirim',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanningResolutionDto)
  planningResolutions?: PlanningResolutionDto[];

  // DB.xlsx tidak punya kolom Tahun/Status Rencana-Realisasi (satu file =
  // satu snapshot anggaran) — jadi dipilih sekali untuk seluruh batch import,
  // bukan per baris. Lihat docs-planning/audit-restrukturisasi-db-xlsx.md §3.1.
  @ApiProperty({ example: 2026 })
  @IsInt()
  tahun: number;

  @ApiProperty({ enum: ['RENCANA', 'REALISASI'] })
  @IsIn(['RENCANA', 'REALISASI'])
  status: 'RENCANA' | 'REALISASI';
}
