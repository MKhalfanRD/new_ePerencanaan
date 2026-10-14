import {
  IsArray,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
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

export class CommitImportDto {
  @ApiProperty({ description: 'Token sesi import dari hasil preview' })
  @IsString()
  sessionId: string;

  @ApiProperty({ type: [BalaiResolutionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BalaiResolutionDto)
  balaiResolutions: BalaiResolutionDto[];
}
