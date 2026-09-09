import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActivityLogService } from './activity-log.service';

@ApiTags('Activity Log')
@ApiBearerAuth()
@Controller('activity-log')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityLogController {
  constructor(private readonly service: ActivityLogService) {}

  // Sengaja HANYA SUPER_ADMIN. Administrator biasa pun tidak boleh —
  // RolesGuard meloloskan SUPER_ADMIN otomatis, jadi daftar di bawah
  // memang tidak perlu menyebutnya.
  @ApiOperation({ summary: 'Log aktivitas seluruh user (SUPER_ADMIN)' })
  @Roles('SUPER_ADMIN')
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('roleCode') roleCode?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 50, 200),
      userId,
      roleCode,
      search,
    });
  }
}
