import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MasterService {
  constructor(private prisma: PrismaService) {}

  // ========== READ ==========
  getBalai() {
    return this.prisma.balai.findMany({ orderBy: { name: 'asc' } });
  }
  getPeriodes() {
    return this.prisma.periode.findMany({ orderBy: { startYear: 'desc' } });
  }
  getPrograms() {
    return this.prisma.program.findMany({ orderBy: { name: 'asc' } });
  }
  getKegiatan() {
    return this.prisma.kegiatan.findMany({
      include: { program: true },
      orderBy: { name: 'asc' },
    });
  }
  getKRO() {
    return this.prisma.kRO.findMany({
      include: { kegiatan: { include: { program: true } } },
      orderBy: { name: 'asc' },
    });
  }
  getRO() {
    return this.prisma.rO.findMany({
      include: {
        indikatorRO: true,
        kro: { include: { kegiatan: { include: { program: true } } } },
      },
      orderBy: { name: 'asc' },
    });
  }
  getKomponen() {
    return this.prisma.komponen.findMany({
      include: { ro: true },
      orderBy: { name: 'asc' },
    });
  }
  // Indikator RENJA (lihat docs-planning/fitur-paket/04-rekonsiliasi-referensi.md)
  getPrioritasNasional() {
    return this.prisma.prioritasNasional.findMany({
      include: {
        programPrioritas: { include: { kegiatanPrioritas: true } },
      },
      orderBy: { code: 'asc' },
    });
  }
  getProgramPrioritas() {
    return this.prisma.programPrioritas.findMany({
      include: { prioritasNasional: true },
      orderBy: { code: 'asc' },
    });
  }
  getKegiatanPrioritas() {
    return this.prisma.kegiatanPrioritas.findMany({
      include: {
        programPrioritas: { include: { prioritasNasional: true } },
      },
      orderBy: { code: 'asc' },
    });
  }
  getPkpn() {
    return this.prisma.pkpn.findMany({ orderBy: { name: 'asc' } });
  }
  getTematikRenja() {
    return this.prisma.tematikRenja.findMany({ orderBy: { name: 'asc' } });
  }
  getSasaranProgram() {
    return this.prisma.sasaranProgram.findMany({
      include: { program: true, indikator: true },
    });
  }
  getSasaranKegiatan() {
    return this.prisma.sasaranKegiatan.findMany({
      include: { kegiatan: true, indikator: true },
    });
  }

  getWilayahSungai() {
    return this.prisma.wilayahSungai.findMany({ orderBy: { name: 'asc' } });
  }
  getRoles() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }

  // ========== BALAI ==========
  createBalai(dto: any) {
    return this.prisma.balai.create({ data: dto });
  }
  updateBalai(id: number, dto: any) {
    return this.prisma.balai.update({ where: { id }, data: dto });
  }
  async deleteBalai(id: number) {
    await this.prisma.balai.delete({ where: { id } });
    return { message: 'Balai berhasil dihapus' };
  }

  // ========== PERIODE ==========
  createPeriode(dto: any) {
    return this.prisma.periode.create({ data: dto });
  }
  updatePeriode(id: number, dto: any) {
    return this.prisma.periode.update({ where: { id }, data: dto });
  }
  async deletePeriode(id: number) {
    await this.prisma.periode.delete({ where: { id } });
    return { message: 'Periode berhasil dihapus' };
  }

  // ========== PROGRAM ==========
  createProgram(dto: any) {
    return this.prisma.program.create({ data: dto });
  }
  updateProgram(id: string, dto: any) {
    return this.prisma.program.update({ where: { id }, data: dto });
  }
  async deleteProgram(id: string) {
    await this.prisma.program.delete({ where: { id } });
    return { message: 'Program berhasil dihapus' };
  }

  // ========== KEGIATAN ==========
  createKegiatan(dto: any) {
    return this.prisma.kegiatan.create({ data: dto });
  }
  updateKegiatan(id: string, dto: any) {
    return this.prisma.kegiatan.update({ where: { id }, data: dto });
  }
  async deleteKegiatan(id: string) {
    await this.prisma.kegiatan.delete({ where: { id } });
    return { message: 'Kegiatan berhasil dihapus' };
  }
  async bulkDeleteKegiatan(ids: string[]) {
    const result = await this.prisma.kegiatan.deleteMany({
      where: { id: { in: ids } },
    });
    return {
      message: `${result.count} Kegiatan berhasil dihapus`,
      count: result.count,
    };
  }

  // ========== KRO ==========
  createKRO(dto: any) {
    return this.prisma.kRO.create({ data: dto });
  }
  updateKRO(id: string, dto: any) {
    return this.prisma.kRO.update({ where: { id }, data: dto });
  }
  async deleteKRO(id: string) {
    await this.prisma.kRO.delete({ where: { id } });
    return { message: 'KRO berhasil dihapus' };
  }
  async bulkDeleteKRO(ids: string[]) {
    const result = await this.prisma.kRO.deleteMany({
      where: { id: { in: ids } },
    });
    return {
      message: `${result.count} KRO berhasil dihapus`,
      count: result.count,
    };
  }

  // ========== RO ==========
  createRO(dto: any) {
    return this.prisma.rO.create({ data: dto });
  }
  updateRO(id: string, dto: any) {
    return this.prisma.rO.update({ where: { id }, data: dto });
  }
  async deleteRO(id: string) {
    await this.prisma.rO.delete({ where: { id } });
    return { message: 'RO berhasil dihapus' };
  }
  async bulkDeleteRO(ids: string[]) {
    const result = await this.prisma.rO.deleteMany({
      where: { id: { in: ids } },
    });
    return {
      message: `${result.count} RO berhasil dihapus`,
      count: result.count,
    };
  }

  // ========== KOMPONEN ==========
  createKomponen(dto: any) {
    return this.prisma.komponen.create({ data: dto });
  }
  updateKomponen(id: string, dto: any) {
    return this.prisma.komponen.update({ where: { id }, data: dto });
  }
  async deleteKomponen(id: string) {
    await this.prisma.komponen.delete({ where: { id } });
    return { message: 'Komponen berhasil dihapus' };
  }
  async bulkDeleteKomponen(ids: string[]) {
    const result = await this.prisma.komponen.deleteMany({
      where: { id: { in: ids } },
    });
    return {
      message: `${result.count} Komponen berhasil dihapus`,
      count: result.count,
    };
  }

  // ========== PRIORITAS NASIONAL (PN) ==========
  createPrioritasNasional(dto: any) {
    return this.prisma.prioritasNasional.create({ data: dto });
  }
  updatePrioritasNasional(id: string, dto: any) {
    return this.prisma.prioritasNasional.update({ where: { id }, data: dto });
  }
  async deletePrioritasNasional(id: string) {
    await this.prisma.prioritasNasional.delete({ where: { id } });
    return { message: 'Prioritas Nasional berhasil dihapus' };
  }

  // ========== PROGRAM PRIORITAS (PP) ==========
  createProgramPrioritas(dto: any) {
    return this.prisma.programPrioritas.create({ data: dto });
  }
  updateProgramPrioritas(id: string, dto: any) {
    return this.prisma.programPrioritas.update({ where: { id }, data: dto });
  }
  async deleteProgramPrioritas(id: string) {
    await this.prisma.programPrioritas.delete({ where: { id } });
    return { message: 'Program Prioritas berhasil dihapus' };
  }

  // ========== KEGIATAN PRIORITAS (KP) ==========
  createKegiatanPrioritas(dto: any) {
    return this.prisma.kegiatanPrioritas.create({ data: dto });
  }
  updateKegiatanPrioritas(id: string, dto: any) {
    return this.prisma.kegiatanPrioritas.update({ where: { id }, data: dto });
  }
  async deleteKegiatanPrioritas(id: string) {
    await this.prisma.kegiatanPrioritas.delete({ where: { id } });
    return { message: 'Kegiatan Prioritas berhasil dihapus' };
  }

  // ========== PKPN ==========
  createPkpn(dto: any) {
    return this.prisma.pkpn.create({ data: dto });
  }
  updatePkpn(id: string, dto: any) {
    return this.prisma.pkpn.update({ where: { id }, data: dto });
  }
  async deletePkpn(id: string) {
    await this.prisma.pkpn.delete({ where: { id } });
    return { message: 'PKPN berhasil dihapus' };
  }

  // ========== TEMATIK RENJA ==========
  createTematikRenja(dto: any) {
    return this.prisma.tematikRenja.create({ data: dto });
  }
  updateTematikRenja(id: string, dto: any) {
    return this.prisma.tematikRenja.update({ where: { id }, data: dto });
  }
  async deleteTematikRenja(id: string) {
    await this.prisma.tematikRenja.delete({ where: { id } });
    return { message: 'Tematik RENJA berhasil dihapus' };
  }

  // ========== SASARAN PROGRAM (SP) & INDIKATORNYA (ISP) ==========
  createSasaranProgram(dto: any) {
    return this.prisma.sasaranProgram.create({ data: dto });
  }
  updateSasaranProgram(id: string, dto: any) {
    return this.prisma.sasaranProgram.update({ where: { id }, data: dto });
  }
  async deleteSasaranProgram(id: string) {
    await this.prisma.sasaranProgram.delete({ where: { id } });
    return { message: 'Sasaran Program berhasil dihapus' };
  }
  createIndikatorSasaranProgram(dto: any) {
    return this.prisma.indikatorSasaranProgram.create({ data: dto });
  }
  updateIndikatorSasaranProgram(id: string, dto: any) {
    return this.prisma.indikatorSasaranProgram.update({
      where: { id },
      data: dto,
    });
  }
  async deleteIndikatorSasaranProgram(id: string) {
    await this.prisma.indikatorSasaranProgram.delete({ where: { id } });
    return { message: 'Indikator Sasaran Program berhasil dihapus' };
  }

  // ========== SASARAN KEGIATAN (SK) & INDIKATORNYA (ISK) ==========
  createSasaranKegiatan(dto: any) {
    return this.prisma.sasaranKegiatan.create({ data: dto });
  }
  updateSasaranKegiatan(id: string, dto: any) {
    return this.prisma.sasaranKegiatan.update({ where: { id }, data: dto });
  }
  async deleteSasaranKegiatan(id: string) {
    await this.prisma.sasaranKegiatan.delete({ where: { id } });
    return { message: 'Sasaran Kegiatan berhasil dihapus' };
  }
  createIndikatorSasaranKegiatan(dto: any) {
    return this.prisma.indikatorSasaranKegiatan.create({ data: dto });
  }
  updateIndikatorSasaranKegiatan(id: string, dto: any) {
    return this.prisma.indikatorSasaranKegiatan.update({
      where: { id },
      data: dto,
    });
  }
  async deleteIndikatorSasaranKegiatan(id: string) {
    await this.prisma.indikatorSasaranKegiatan.delete({ where: { id } });
    return { message: 'Indikator Sasaran Kegiatan berhasil dihapus' };
  }

  // ========== WILAYAH SUNGAI ==========
  createWilayahSungai(dto: any) {
    return this.prisma.wilayahSungai.create({ data: dto });
  }
  updateWilayahSungai(id: string, dto: any) {
    return this.prisma.wilayahSungai.update({ where: { id }, data: dto });
  }
  async deleteWilayahSungai(id: string) {
    await this.prisma.wilayahSungai.delete({ where: { id } });
    return { message: 'Wilayah Sungai berhasil dihapus' };
  }
}
