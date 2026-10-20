import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Realisasi 1 paket 1 tahun per sumber dana. Semua kosong/0 = hapus realisasi tahun itu. */
export class RealisasiDto {
  @ApiProperty({ example: 2026 }) @IsInt() tahun: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) rm?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) rmp?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) pln?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) sbsn?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) kpbu?: number | null;
}
