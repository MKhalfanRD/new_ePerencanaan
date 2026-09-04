import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MasterService } from './master.service';

@ApiTags('Master Data')
@ApiBearerAuth()
@Controller('master')
@UseGuards(JwtAuthGuard)
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  // ========== READ (semua role) ==========
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

  @ApiOperation({ summary: 'Daftar semua RO' })
  @Get('ro')
  getRO() {
    return this.masterService.getRO();
  }

  @ApiOperation({ summary: 'Daftar semua Komponen' })
  @Get('komponen')
  getKomponen() {
    return this.masterService.getKomponen();
  }

  @ApiOperation({ summary: 'Daftar Prioritas Nasional (PN, dengan PP & KP)' })
  @Get('prioritas-nasional')
  getPrioritasNasional() {
    return this.masterService.getPrioritasNasional();
  }

  @ApiOperation({ summary: 'Daftar Program Prioritas (PP)' })
  @Get('program-prioritas')
  getProgramPrioritas() {
    return this.masterService.getProgramPrioritas();
  }

  @ApiOperation({ summary: 'Daftar Kegiatan Prioritas (KP)' })
  @Get('kegiatan-prioritas')
  getKegiatanPrioritas() {
    return this.masterService.getKegiatanPrioritas();
  }

  @ApiOperation({ summary: 'Daftar PKPN' })
  @Get('pkpn')
  getPkpn() {
    return this.masterService.getPkpn();
  }

  @ApiOperation({ summary: 'Daftar Tematik RENJA' })
  @Get('tematik-renja')
  getTematikRenja() {
    return this.masterService.getTematikRenja();
  }

  @ApiOperation({ summary: 'Daftar Sasaran Program (SP, dengan ISP)' })
  @Get('sasaran-program')
  getSasaranProgram() {
    return this.masterService.getSasaranProgram();
  }

  @ApiOperation({ summary: 'Daftar Sasaran Kegiatan (SK, dengan ISK)' })
  @Get('sasaran-kegiatan')
  getSasaranKegiatan() {
    return this.masterService.getSasaranKegiatan();
  }

  @ApiOperation({ summary: 'Daftar semua Wilayah Sungai' })
  @Get('wilayah-sungai')
  getWilayahSungai() {
    return this.masterService.getWilayahSungai();
  }

  @ApiOperation({ summary: 'Daftar semua Role' })
  @Get('roles')
  getRoles() {
    return this.masterService.getRoles();
  }

  // ========== CRUD BALAI ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('balai')
  createBalai(@Body() dto: any) {
    return this.masterService.createBalai(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('balai/:id')
  updateBalai(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateBalai(Number(id), dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('balai/:id')
  deleteBalai(@Param('id') id: string) {
    return this.masterService.deleteBalai(Number(id));
  }

  // ========== CRUD PERIODE ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('periodes')
  createPeriode(@Body() dto: any) {
    return this.masterService.createPeriode(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('periodes/:id')
  updatePeriode(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updatePeriode(Number(id), dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('periodes/:id')
  deletePeriode(@Param('id') id: string) {
    return this.masterService.deletePeriode(Number(id));
  }

  // ========== CRUD PROGRAM ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('programs')
  createProgram(@Body() dto: any) {
    return this.masterService.createProgram(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('programs/:id')
  updateProgram(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateProgram(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('programs/:id')
  deleteProgram(@Param('id') id: string) {
    return this.masterService.deleteProgram(id);
  }

  // ========== CRUD KEGIATAN ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('kegiatan')
  createKegiatan(@Body() dto: any) {
    return this.masterService.createKegiatan(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('kegiatan/:id')
  updateKegiatan(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateKegiatan(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('kegiatan/:id')
  deleteKegiatan(@Param('id') id: string) {
    return this.masterService.deleteKegiatan(id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('kegiatan/bulk-delete')
  bulkDeleteKegiatan(@Body('ids') ids: string[]) {
    return this.masterService.bulkDeleteKegiatan(ids);
  }

  // ========== CRUD KRO ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('kro')
  createKRO(@Body() dto: any) {
    return this.masterService.createKRO(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('kro/:id')
  updateKRO(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateKRO(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('kro/:id')
  deleteKRO(@Param('id') id: string) {
    return this.masterService.deleteKRO(id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('kro/bulk-delete')
  bulkDeleteKRO(@Body('ids') ids: string[]) {
    return this.masterService.bulkDeleteKRO(ids);
  }

  // ========== CRUD RO ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('ro')
  createRO(@Body() dto: any) {
    return this.masterService.createRO(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('ro/:id')
  updateRO(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateRO(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('ro/:id')
  deleteRO(@Param('id') id: string) {
    return this.masterService.deleteRO(id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('ro/bulk-delete')
  bulkDeleteRO(@Body('ids') ids: string[]) {
    return this.masterService.bulkDeleteRO(ids);
  }

  // ========== CRUD KOMPONEN ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('komponen')
  createKomponen(@Body() dto: any) {
    return this.masterService.createKomponen(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('komponen/:id')
  updateKomponen(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateKomponen(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('komponen/:id')
  deleteKomponen(@Param('id') id: string) {
    return this.masterService.deleteKomponen(id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('komponen/bulk-delete')
  bulkDeleteKomponen(@Body('ids') ids: string[]) {
    return this.masterService.bulkDeleteKomponen(ids);
  }

  // ========== CRUD PRIORITAS NASIONAL / PROGRAM / KEGIATAN PRIORITAS ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('prioritas-nasional')
  createPrioritasNasional(@Body() dto: any) {
    return this.masterService.createPrioritasNasional(dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('prioritas-nasional/:id')
  updatePrioritasNasional(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updatePrioritasNasional(id, dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('prioritas-nasional/:id')
  deletePrioritasNasional(@Param('id') id: string) {
    return this.masterService.deletePrioritasNasional(id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('program-prioritas')
  createProgramPrioritas(@Body() dto: any) {
    return this.masterService.createProgramPrioritas(dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('program-prioritas/:id')
  updateProgramPrioritas(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateProgramPrioritas(id, dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('program-prioritas/:id')
  deleteProgramPrioritas(@Param('id') id: string) {
    return this.masterService.deleteProgramPrioritas(id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('kegiatan-prioritas')
  createKegiatanPrioritas(@Body() dto: any) {
    return this.masterService.createKegiatanPrioritas(dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('kegiatan-prioritas/:id')
  updateKegiatanPrioritas(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateKegiatanPrioritas(id, dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('kegiatan-prioritas/:id')
  deleteKegiatanPrioritas(@Param('id') id: string) {
    return this.masterService.deleteKegiatanPrioritas(id);
  }

  // ========== CRUD PKPN ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('pkpn')
  createPkpn(@Body() dto: any) {
    return this.masterService.createPkpn(dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('pkpn/:id')
  updatePkpn(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updatePkpn(id, dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('pkpn/:id')
  deletePkpn(@Param('id') id: string) {
    return this.masterService.deletePkpn(id);
  }

  // ========== CRUD TEMATIK RENJA ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('tematik-renja')
  createTematikRenja(@Body() dto: any) {
    return this.masterService.createTematikRenja(dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('tematik-renja/:id')
  updateTematikRenja(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateTematikRenja(id, dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('tematik-renja/:id')
  deleteTematikRenja(@Param('id') id: string) {
    return this.masterService.deleteTematikRenja(id);
  }

  // ========== CRUD SASARAN PROGRAM / KEGIATAN + INDIKATORNYA ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('sasaran-program')
  createSasaranProgram(@Body() dto: any) {
    return this.masterService.createSasaranProgram(dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('sasaran-program/:id')
  updateSasaranProgram(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateSasaranProgram(id, dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('sasaran-program/:id')
  deleteSasaranProgram(@Param('id') id: string) {
    return this.masterService.deleteSasaranProgram(id);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('sasaran-program/indikator')
  createIndikatorSasaranProgram(@Body() dto: any) {
    return this.masterService.createIndikatorSasaranProgram(dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('sasaran-program/indikator/:id')
  updateIndikatorSasaranProgram(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateIndikatorSasaranProgram(id, dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('sasaran-program/indikator/:id')
  deleteIndikatorSasaranProgram(@Param('id') id: string) {
    return this.masterService.deleteIndikatorSasaranProgram(id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('sasaran-kegiatan')
  createSasaranKegiatan(@Body() dto: any) {
    return this.masterService.createSasaranKegiatan(dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('sasaran-kegiatan/:id')
  updateSasaranKegiatan(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateSasaranKegiatan(id, dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('sasaran-kegiatan/:id')
  deleteSasaranKegiatan(@Param('id') id: string) {
    return this.masterService.deleteSasaranKegiatan(id);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('sasaran-kegiatan/indikator')
  createIndikatorSasaranKegiatan(@Body() dto: any) {
    return this.masterService.createIndikatorSasaranKegiatan(dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('sasaran-kegiatan/indikator/:id')
  updateIndikatorSasaranKegiatan(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateIndikatorSasaranKegiatan(id, dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('sasaran-kegiatan/indikator/:id')
  deleteIndikatorSasaranKegiatan(@Param('id') id: string) {
    return this.masterService.deleteIndikatorSasaranKegiatan(id);
  }

  // ========== CRUD WILAYAH SUNGAI ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('wilayah-sungai')
  createWilayahSungai(@Body() dto: any) {
    return this.masterService.createWilayahSungai(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('wilayah-sungai/:id')
  updateWilayahSungai(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateWilayahSungai(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('wilayah-sungai/:id')
  deleteWilayahSungai(@Param('id') id: string) {
    return this.masterService.deleteWilayahSungai(id);
  }
}
