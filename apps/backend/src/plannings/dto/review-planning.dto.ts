import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewPlanningDto {
  @ApiProperty({ enum: ['approve', 'revision', 'reject'] })
  @IsIn(['approve', 'revision', 'reject'])
  action: string;

  @ApiPropertyOptional({ example: 'Mohon dilengkapi dokumen lingkungan' })
  @IsOptional()
  @IsString()
  catatan?: string;
}
