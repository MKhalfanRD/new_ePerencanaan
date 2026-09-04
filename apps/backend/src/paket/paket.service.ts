import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreatePaketDto } from './dto/create-paket.dto';
import { UpdatePaketDto } from './dto/update-paket.dto';
import { generateKodeProyek, generateKodePaket } from '../common/kode-generator';

const paketDetailInclude = {
  planning: { select: { id: true, projectName: true, status: true } },
  ro: {
    include: {
      kro: { include: { kegiatan: { include: { program: true } } } },
    },
  },
  komponen: true,
  wilayahSungai: true,
  kegiatanPrioritas: {
    include: { programPrioritas: { include: { prioritasNasional: true } } },
  },
  pkpn: true,
  tematikRenja: true,
  indikatorSasaranProgram: { include: { sasaranProgram: true } },
  indikatorSasaranKegiatan: { include: { sasaranKegiatan: true } },
  indikatorRo: true,
  alokasi: {
    include: { lokasi: true },
    orderBy: [{ tahun: 'asc' as const }, { status: 'asc' as const }],
  },
  // `prioritas` sengaja tidak di-include — relasi itu sudah dibuang dari
  // model Paket (lihat docs-planning/audit-restrukturisasi-db-xlsx.md §4).
};

@Injectable()
export class PaketService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // Sama seperti AlokasiService — planning list/detail di-cache di Redis dan
  // sebelumnya tidak pernah diinvalidasi dari sini, jadi paket baru/edit
  // tidak kelihatan di tabel proyek sampai TTL cache habis.
  private async invalidatePlanning(planningId: string) {
    await this.redis.del(`planning:${planningId}`);
    await this.redis.delByPrefix('plannings:list:');
  }

  async create(dto: CreatePaketDto) {
    const planning = await this.prisma.planning.findUnique({
      where: { id: dto.planningId },
    });
    if (!planning) throw new NotFoundException('Planning tidak ditemukan');

    const result = await this.prisma.$transaction(async (tx) => {
      // Kode Proyek seharusnya sudah ada dari saat proyek dibuat — fallback
      // generate di sini cuma jaga-jaga untuk data lama sebelum fitur ini ada.
      const kodeProyek =
        planning.kodeProyek ??
        (await (async () => {
          const generated = await generateKodeProyek(tx);
          await tx.planning.update({
            where: { id: planning.id },
            data: { kodeProyek: generated },
          });
          return generated;
        })());
      const kodePaket = await generateKodePaket(tx, kodeProyek);

      return tx.paket.create({
        data: {
          planningId: dto.planningId,
          kodePaket,
          name: dto.name,
        roId: dto.roId,
        komponenId: dto.komponenId,
        jenis: dto.jenis as any,
        masaPelaksanaan: dto.masaPelaksanaan as any,
        wilayahSungaiId: dto.wilayahSungaiId,
        dokLingStatus: dto.dokLingStatus,
        catatanPembina: dto.catatanPembina,
        catatanSspsda: dto.catatanSspsda,
        kegiatanPrioritasId: dto.kegiatanPrioritasId,
        pkpnId: dto.pkpnId,
        indikatorSasaranProgramId: dto.indikatorSasaranProgramId,
        indikatorSasaranKegiatanId: dto.indikatorSasaranKegiatanId,
          indikatorRoId: dto.indikatorRoId,
          tematikRenjaId: dto.tematikRenjaId,
          fkb: dto.fkb ?? false,
          fkw: dto.fkw ?? false,
          mpa: dto.mpa ?? false,
        },
        include: paketDetailInclude,
      });
    });

    await this.invalidatePlanning(dto.planningId);
    return result;
  }

  async findOne(id: string) {
    const paket = await this.prisma.paket.findUnique({
      where: { id },
      include: paketDetailInclude,
    });
    if (!paket) throw new NotFoundException('Paket tidak ditemukan');
    return paket;
  }

  async update(id: string, dto: UpdatePaketDto) {
    const paket = await this.prisma.paket.findUnique({ where: { id } });
    if (!paket) throw new NotFoundException('Paket tidak ditemukan');

    const updated = await this.prisma.paket.update({
      where: { id },
      data: {
        // kodePaket sengaja tidak diikutkan — dibuat sekali saat create,
        // permanen, tidak bisa diubah lewat edit.
        name: dto.name,
        roId: dto.roId,
        komponenId: dto.komponenId,
        jenis: dto.jenis as any,
        masaPelaksanaan: dto.masaPelaksanaan as any,
        wilayahSungaiId: dto.wilayahSungaiId,
        dokLingStatus: dto.dokLingStatus,
        catatanPembina: dto.catatanPembina,
        catatanSspsda: dto.catatanSspsda,
        kegiatanPrioritasId: dto.kegiatanPrioritasId,
        pkpnId: dto.pkpnId,
        indikatorSasaranProgramId: dto.indikatorSasaranProgramId,
        indikatorSasaranKegiatanId: dto.indikatorSasaranKegiatanId,
        indikatorRoId: dto.indikatorRoId,
        tematikRenjaId: dto.tematikRenjaId,
        fkb: dto.fkb,
        fkw: dto.fkw,
        mpa: dto.mpa,
      },
      include: paketDetailInclude,
    });

    await this.invalidatePlanning(paket.planningId);
    return updated;
  }

  async remove(id: string) {
    const paket = await this.prisma.paket.findUnique({ where: { id } });
    if (!paket) throw new NotFoundException('Paket tidak ditemukan');
    // Soft delete, konsisten dengan Planning.deletedAt
    await this.prisma.paket.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.invalidatePlanning(paket.planningId);
    return { message: 'Paket berhasil dihapus' };
  }
}
