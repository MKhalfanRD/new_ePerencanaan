import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAlokasiDto {
  @ApiProperty()
  @IsString()
  planningId: string;

  @ApiProperty()
  @IsString()
  roId: string;

  @ApiProperty()
  @IsInt()
  tahun: number;

  @ApiProperty({ enum: ['RENCANA', 'REALISASI'] })
  @IsEnum(['RENCANA', 'REALISASI'])
  status: string;

  @ApiPropertyOptional()
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

export class UpdateAlokasiDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() rm?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() rmp?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() pln?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sbsn?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() kpbu?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() outputTarget?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() outputUnit?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() outcomeTarget?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() outcomeUnit?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() catatan?: string;
}

export class CreateLokasiDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ enum: ['TITIK', 'GARIS', 'POLIGON'], default: 'TITIK' })
  @IsIn(['TITIK', 'GARIS', 'POLIGON'])
  tipeKoordinat: string;

  @ApiPropertyOptional() @IsOptional() @IsString() provinceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() provinceName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cityName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() districtId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() districtName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() villageId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() villageName?: string;

  @ApiPropertyOptional({ description: 'Untuk tipe TITIK' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Untuk tipe TITIK' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Untuk tipe GARIS/POLIGON, array [[lat,lng],...]',
  })
  @IsOptional()
  coordinates?: number[][];
}
