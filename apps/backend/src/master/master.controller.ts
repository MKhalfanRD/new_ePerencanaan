import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MasterService } from './master.service';

@ApiTags('Master Data')
@ApiBearerAuth()
@Controller('master')
@UseGuards(JwtAuthGuard)
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  @ApiOperation({ summary: 'Daftar semua balai' })
  @Get('balai')
  getBalai() {
    return this.masterService.getBalai();
  }

  @ApiOperation({ summary: 'Daftar semua periode' })
  @Get('periodes')
  getPeriodes() {
    return this.masterService.getPeriodes();
  }

  @ApiOperation({ summary: 'Daftar semua program' })
  @Get('programs')
  getPrograms() {
    return this.masterService.getPrograms();
  }

  @ApiOperation({ summary: 'Daftar semua kegiatan' })
  @Get('kegiatan')
  getKegiatan() {
    return this.masterService.getKegiatan();
  }

  @ApiOperation({ summary: 'Daftar semua KRO' })
  @Get('kro')
  getKRO() {
    return this.masterService.getKRO();
  }

  @ApiOperation({ summary: 'Daftar semua RO beserta IndikatorRO' })
  @Get('ro')
  getRO() {
    return this.masterService.getRO();
  }

  @ApiOperation({ summary: 'Daftar semua Major Project' })
  @Get('major-projects')
  getMajorProjects() {
    return this.masterService.getMajorProjects();
  }

  @ApiOperation({ summary: 'Daftar semua Tindak Lanjut' })
  @Get('tindak-lanjut')
  getTindakLanjut() {
    return this.masterService.getTindakLanjut();
  }

  @ApiOperation({ summary: 'Daftar semua Wilayah Sungai' })
  @Get('wilayah-sungai')
  getWilayahSungai() {
    return this.masterService.getWilayahSungai();
  }

  @ApiOperation({ summary: 'Daftar semua role' })
@Get('roles')
getRoles() { return this.masterService.getRoles(); }
}
