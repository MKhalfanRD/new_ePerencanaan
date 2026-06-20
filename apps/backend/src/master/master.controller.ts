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

  // ========== CRUD MAJOR PROJECT ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('major-projects')
  createMajorProject(@Body() dto: any) {
    return this.masterService.createMajorProject(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('major-projects/:id')
  updateMajorProject(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateMajorProject(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('major-projects/:id')
  deleteMajorProject(@Param('id') id: string) {
    return this.masterService.deleteMajorProject(id);
  }

  // ========== CRUD TINDAK LANJUT ==========
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Post('tindak-lanjut')
  createTindakLanjut(@Body() dto: any) {
    return this.masterService.createTindakLanjut(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Patch('tindak-lanjut/:id')
  updateTindakLanjut(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateTindakLanjut(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMINISTRATOR')
  @Delete('tindak-lanjut/:id')
  deleteTindakLanjut(@Param('id') id: string) {
    return this.masterService.deleteTindakLanjut(id);
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
