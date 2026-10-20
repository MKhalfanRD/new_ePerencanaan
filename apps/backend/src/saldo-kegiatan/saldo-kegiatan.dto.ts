import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 1 tahun: total wajib (null = hapus saldo tahun itu), pecahan opsional. */
export class SaldoTahunDto {
  @ApiProperty({ example: 2026 }) @IsInt() tahun: number;
  @ApiProperty({ nullable: true }) @IsOptional() @IsNumber() @Min(0) total: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) rm?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) rmp?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) pln?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) sbsn?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) kpbu?: number | null;
}

export class TetapkanSaldoDto {
  @ApiProperty() @IsString() @MinLength(3) alasan: string;
  @ApiProperty({ type: [SaldoTahunDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaldoTahunDto)
  tahun: SaldoTahunDto[];
}
