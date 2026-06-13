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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AlokasiService } from './alokasi.service';
import {
  CreateAlokasiDto,
  UpdateAlokasiDto,
  CreateLokasiDto,
} from './dto/create-alokasi.dto';

@ApiTags('Alokasi')
@ApiBearerAuth()
@Controller('alokasi')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlokasiController {
  constructor(private readonly alokasiService: AlokasiService) {}

  @ApiOperation({ summary: 'Tambah alokasi ke planning' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Post()
  create(@Body() dto: CreateAlokasiDto) {
    return this.alokasiService.create(dto);
  }

  @ApiOperation({ summary: 'Edit alokasi (otomatis simpan histori)' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAlokasiDto,
    @CurrentUser() user: any,
  ) {
    return this.alokasiService.update(id, dto, user);
  }

  @ApiOperation({ summary: 'Hapus alokasi' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.alokasiService.remove(id);
  }

  @ApiOperation({ summary: 'Tambah lokasi ke alokasi' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Post(':id/lokasi')
  addLokasi(@Param('id') id: string, @Body() dto: CreateLokasiDto) {
    return this.alokasiService.addLokasi(id, dto);
  }

  @ApiOperation({ summary: 'Hapus lokasi alokasi' })
  @Roles('SATKER', 'ADMINISTRATOR')
  @Delete('lokasi/:lokasiId')
  removeLokasi(@Param('lokasiId') lokasiId: string) {
    return this.alokasiService.removeLokasi(lokasiId);
  }

  @ApiOperation({ summary: 'Lihat histori perubahan alokasi' })
  @Roles('SATKER', 'VERIFICATOR', 'ADMINISTRATOR')
  @Get(':id/histori')
  getHistori(@Param('id') id: string) {
    return this.alokasiService.getHistori(id);
  }
}
