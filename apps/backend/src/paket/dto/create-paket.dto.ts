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
import { FormValueDto } from '../../proyek/dto/preview-skor.dto';

/** Rincian 1 tahun (alokasi RENCANA): komponen, volume RO/IRO & rupiah per
 * sumber dana. */
export class PaketAlokasiDto {
  @ApiProperty({ example: 2026 }) @IsInt() tahun: number;
  @ApiPropertyOptional() @IsOptional() @IsString() komponenId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() volumeRo?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() volumeIro?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() rm?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() rmp?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() pln?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sbsn?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() kpbu?: number;
}

/** Isian 1 paket (format baru) — dipakai POST/PATCH /paket & Buat Proyek. */
export class PaketInputDto {
  // kodePaket sengaja tidak ada di sini — digenerate otomatis di service.
  @ApiProperty() @IsString() name: string;

  @ApiProperty({ example: '005' }) @IsString() roId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() satkerId?: string;

  @ApiPropertyOptional({ type: [String], description: 'id provinsi' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lokasiRo?: string[];

  // 1 Indikator RO per paket; volumenya diisi per tahun (PaketAlokasiDto).
  @ApiPropertyOptional() @IsOptional() @IsString() indikatorRoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() satuanIro?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() tahunMulai?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() tahunSelesai?: number;

  @ApiPropertyOptional({ type: [PaketAlokasiDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaketAlokasiDto)
  alokasi?: PaketAlokasiDto[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean() lokasiSamaProyek?: boolean;
  @ApiPropertyOptional({ enum: ['TITIK', 'GARIS', 'POLIGON'] })
  @IsOptional()
  @IsEnum(['TITIK', 'GARIS', 'POLIGON'])
  tipeKoordinat?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() provinceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() provinceName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cityName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() districtId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() districtName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() villageId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() villageName?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() coordinates?: number[][];

  // Isian field custom tab Pemaketan (paket_form_value).
  @ApiPropertyOptional({ type: [FormValueDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormValueDto)
  formValues?: FormValueDto[];
}

export class CreatePaketDto extends PaketInputDto {
  @ApiProperty() @IsString() proyekId: string;
}
