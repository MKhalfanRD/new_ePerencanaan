import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlanningsService } from './plannings.service';
import { CreatePlanningDto } from './dto/create-planning.dto';
import { UpdatePlanningDto } from './dto/update-planning.dto';
import { QueryPlanningDto } from './dto/query-planning.dto';

@ApiTags('Plannings')
@ApiBearerAuth()
@Controller('plannings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlanningsController {
  constructor(private readonly planningsService: PlanningsService) {}

  @ApiOperation({ summary: 'Buat planning baru' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Post()
  create(@Body() dto: CreatePlanningDto, @CurrentUser() user: any) {
    return this.planningsService.create(dto, user.userId);
  }

  @ApiOperation({ summary: 'Daftar planning dengan pagination & filter' })
  @Roles('SATKER', 'VERIFICATOR', 'ADMINISTRATOR')
  @Get()
  findAll(@CurrentUser() user: any, @Query() query: QueryPlanningDto) {
    return this.planningsService.findAll(user, query);
  }

  @ApiOperation({ summary: 'Detail planning' })
  @ApiParam({ name: 'id' })
  @Roles('SATKER', 'VERIFICATOR', 'ADMINISTRATOR')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.planningsService.findOne(id, user);
  }

  @ApiOperation({ summary: 'Setujui planning (DRAFT → APPROVED)' })
  @Roles('ADMINISTRATOR')
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.planningsService.approve(id);
  }

  @ApiOperation({ summary: 'Kembalikan planning ke draft (APPROVED → DRAFT)' })
  @Roles('ADMINISTRATOR')
  @Patch(':id/unapprove')
  unapprove(@Param('id') id: string) {
    return this.planningsService.unapprove(id);
  }

  @ApiOperation({ summary: 'Edit planning (hanya DRAFT)' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanningDto,
    @CurrentUser() user: any,
  ) {
    return this.planningsService.update(id, dto, user);
  }

  @ApiOperation({ summary: 'Hapus planning (hanya DRAFT)' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.planningsService.remove(id, user);
  }
}
