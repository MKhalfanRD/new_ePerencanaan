import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SaldoKegiatanService } from './saldo-kegiatan.service';
import { TetapkanSaldoDto } from './saldo-kegiatan.dto';

@ApiTags('Saldo Kegiatan')
@ApiBearerAuth()
@Controller('saldo-kegiatan')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SaldoKegiatanController {
  constructor(private readonly service: SaldoKegiatanService) {}

  @ApiOperation({ summary: 'Saldo & pemakaian semua kegiatan (per balai) untuk 1 tahun' })
  @Get()
  daftar(@Query('tahun', ParseIntPipe) tahun: number, @CurrentUser() user: any) {
    return this.service.daftar(user, tahun);
  }

  @ApiOperation({ summary: 'Saldo & pemakaian 1 kegiatan per tahun' })
  @Get(':kegiatanId')
  perTahun(
    @Param('kegiatanId') kegiatanId: string,
    @Query('dari', ParseIntPipe) dari: number,
    @Query('sampai', ParseIntPipe) sampai: number,
    @Query('kecualiProyek') kecualiProyek: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.perTahun(user, kegiatanId, dari, sampai, kecualiProyek || undefined);
  }

  @ApiOperation({ summary: 'Tetapkan saldo kegiatan per tahun (Admin / Super Admin)' })
  @Roles('ADMINISTRATOR')
  @Patch(':kegiatanId')
  tetapkan(@Param('kegiatanId') kegiatanId: string, @Body() dto: TetapkanSaldoDto, @CurrentUser() user: any) {
    return this.service.tetapkan(user, kegiatanId, dto);
  }
}
