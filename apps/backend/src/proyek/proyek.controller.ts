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
import { ProyekService } from './proyek.service';
import { CreateProyekDto } from './dto/create-proyek.dto';
import { UpdateProyekDto } from './dto/update-proyek.dto';
import { QueryProyekDto } from './dto/query-proyek.dto';

@ApiTags('Proyek')
@ApiBearerAuth()
@Controller('proyek')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProyekController {
  constructor(private readonly proyekService: ProyekService) {}

  @ApiOperation({ summary: 'Buat proyek baru' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Post()
  create(@Body() dto: CreateProyekDto, @CurrentUser() user: any) {
    return this.proyekService.create(dto, user.userId, user.role);
  }

  @ApiOperation({ summary: 'Daftar proyek dengan pagination & filter' })
  @Roles('SATKER', 'VERIFICATOR', 'ADMINISTRATOR')
  @Get()
  findAll(@CurrentUser() user: any, @Query() query: QueryProyekDto) {
    return this.proyekService.findAll(user, query);
  }

  @ApiOperation({ summary: 'Detail proyek' })
  @ApiParam({ name: 'id' })
  @Roles('SATKER', 'VERIFICATOR', 'ADMINISTRATOR')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.proyekService.findOne(id, user);
  }

  @ApiOperation({ summary: 'Setujui proyek (DRAFT → APPROVED)' })
  @Roles('ADMINISTRATOR')
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.proyekService.approve(id);
  }

  @ApiOperation({ summary: 'Kembalikan proyek ke draft (APPROVED → DRAFT)' })
  @Roles('ADMINISTRATOR')
  @Patch(':id/unapprove')
  unapprove(@Param('id') id: string) {
    return this.proyekService.unapprove(id);
  }

  @ApiOperation({ summary: 'Edit proyek (hanya DRAFT)' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProyekDto,
    @CurrentUser() user: any,
  ) {
    return this.proyekService.update(id, dto, user);
  }

  @ApiOperation({ summary: 'Hapus proyek (hanya DRAFT)' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.proyekService.remove(id, user);
  }
}
