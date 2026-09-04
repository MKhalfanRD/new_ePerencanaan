import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaketService } from './paket.service';
import { CreatePaketDto } from './dto/create-paket.dto';
import { UpdatePaketDto } from './dto/update-paket.dto';

@ApiTags('Paket')
@ApiBearerAuth()
@Controller('paket')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaketController {
  constructor(private readonly paketService: PaketService) {}

  @ApiOperation({ summary: 'Tambah paket ke planning' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Post()
  create(@Body() dto: CreatePaketDto) {
    return this.paketService.create(dto);
  }

  @ApiOperation({
    summary: 'Detail paket lengkap (nomenklatur, alokasi, lokasi)',
  })
  @Roles('SATKER', 'VERIFICATOR', 'ADMINISTRATOR')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paketService.findOne(id);
  }

  @ApiOperation({ summary: 'Edit paket' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePaketDto) {
    return this.paketService.update(id, dto);
  }

  @ApiOperation({ summary: 'Hapus paket' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paketService.remove(id);
  }
}
