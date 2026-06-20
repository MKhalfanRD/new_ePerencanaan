import {
  IsArray,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
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
    description: 'Jika true, buat balai baru dengan nama dari Excel',
  })
  @IsOptional()
  @IsBoolean()
  createNew?: boolean;
}

export class PlanningResolutionDto {
  @ApiProperty({ description: 'Key unik planning: balaiName|namaProyek' })
  @IsString()
  groupKey: string;

  @ApiProperty({
    enum: ['skip', 'replace'],
    description:
      'skip = pakai data lama, replace = ganti dengan data Excel baru',
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
      'Keputusan untuk planning yang sudah ada (skip/replace). Default: skip semua jika tidak dikirim',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanningResolutionDto)
  planningResolutions?: PlanningResolutionDto[];
}
