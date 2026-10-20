import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JenisLaporan, LaporanService } from './laporan.service';

const JENIS: JenisLaporan[] = ['alokasi', 'proyek', 'saldo'];
const STATUS = ['DRAFT', 'DIAJUKAN', 'DIPERIKSA', 'DIKEMBALIKAN', 'APPROVED'];

@ApiTags('Laporan')
@ApiBearerAuth()
@Controller('laporan')
@UseGuards(JwtAuthGuard)
export class LaporanController {
  constructor(private readonly service: LaporanService) {}

  @ApiOperation({ summary: 'Data laporan (alokasi | proyek | saldo), isi sesuai cakupan akun' })
  @Get(':jenis')
  buat(
    @Param('jenis') jenis: string,
    @Query('tahun') tahun: string | undefined,
    @Query('kegiatanId') kegiatanId: string | undefined,
    @Query('balaiId') balaiId: string | undefined,
    @Query('status') status: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (!JENIS.includes(jenis as JenisLaporan)) throw new BadRequestException('Jenis laporan tidak dikenal');
    if (status && !STATUS.includes(status)) throw new BadRequestException('Status tidak dikenal');
    const t = tahun ? Number(tahun) : undefined;
    if (t !== undefined && !Number.isInteger(t)) throw new BadRequestException('Tahun tidak valid');
    return this.service.buat(
      jenis as JenisLaporan,
      { tahun: t, kegiatanId: kegiatanId || undefined, balaiId: balaiId ? Number(balaiId) : undefined, status: status || undefined },
      user,
    );
  }
}
