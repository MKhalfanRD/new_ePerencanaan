import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaketDto {
  @ApiProperty()
  @IsString()
  proyekId: string;

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
  dokLingStatus?: string;

  // PKPN/ISP/ISK/Tematik/fkb/fkw/mpa/catatan pindah ke Proyek (1 proyek =
  // 1 set tagging) — lihat CreateProyekDto.
  @ApiPropertyOptional() @IsOptional() @IsString() indikatorRoId?: string;
}
