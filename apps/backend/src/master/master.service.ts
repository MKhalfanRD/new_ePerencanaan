import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MasterService {
  constructor(private prisma: PrismaService) {}

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

  getMajorProjects() {
    return this.prisma.majorProject.findMany({ orderBy: { name: 'asc' } });
  }

  getTindakLanjut() {
    return this.prisma.tindakLanjut.findMany({ orderBy: { name: 'asc' } });
  }

  getWilayahSungai() {
    return this.prisma.wilayahSungai.findMany({ orderBy: { name: 'asc' } });
  }
}
