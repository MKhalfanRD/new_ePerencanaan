import { IsOptional, IsIn, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryPlanningDto {
  @ApiPropertyOptional({
    enum: ['DRAFT', 'SUBMITTED', 'REVISION', 'REJECTED', 'APPROVED'],
  })
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'REVISION', 'REJECTED', 'APPROVED'])
  status?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter berdasarkan ID periode' })
  @IsOptional()
  @Type(() => Number)
  periodeId?: number;
}
