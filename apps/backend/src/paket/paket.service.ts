import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreatePaketDto } from './dto/create-paket.dto';
import { UpdatePaketDto } from './dto/update-paket.dto';
import {
  generateKodeProyek,
  generateKodePaket,
} from '../common/kode-generator';

const paketDetailInclude = {
  proyek: { select: { id: true, projectName: true, status: true } },
  ro: {
    include: {
      kro: { include: { kegiatan: { include: { program: true } } } },
    },
  },
  komponen: true,
  indikatorRo: true,
  alokasi: {
    include: { lokasi: true },
    orderBy: [{ tahun: 'asc' as const }, { status: 'asc' as const }],
  },
  // PKPN/ISP/ISK/Tematik sengaja tidak di-include — pindah ke Proyek (lihat
  // schema.prisma & CreateProyekDto).
};

@Injectable()
export class PaketService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // Sama seperti AlokasiService — proyek list/detail di-cache di Redis dan
  // sebelumnya tidak pernah diinvalidasi dari sini, jadi paket baru/edit
  // tidak kelihatan di tabel proyek sampai TTL cache habis.
  private async invalidateProyek(proyekId: string) {
    await this.redis.del(`proyek:${proyekId}`);
    await this.redis.delByPrefix('proyek:list:');
  }

  async create(dto: CreatePaketDto, userRole?: string) {
    const proyek = await this.prisma.proyek.findUnique({
      where: { id: dto.proyekId },
      include: { balai: { select: { isActive: true } } },
    });
    if (!proyek) throw new NotFoundException('Proyek tidak ditemukan');
    // ADMINISTRATOR tidak terkena batasan — flag ini cuma membatasi SATKER
    // balai yang dinonaktifkan admin.
    if (!proyek.balai?.isActive && userRole !== 'ADMINISTRATOR') {
      throw new ForbiddenException(
        'Balai ini sedang dinonaktifkan oleh admin, tidak bisa membuat paket baru',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Kode Proyek seharusnya sudah ada dari saat proyek dibuat — fallback
      // generate di sini cuma jaga-jaga untuk data lama sebelum fitur ini ada.
      const kodeProyek =
        proyek.kodeProyek ??
        (await (async () => {
          const generated = await generateKodeProyek(tx);
          await tx.proyek.update({
            where: { id: proyek.id },
            data: { kodeProyek: generated },
          });
          return generated;
        })());
      const kodePaket = await generateKodePaket(tx, kodeProyek);

      return tx.paket.create({
        data: {
          proyekId: dto.proyekId,
          kodePaket,
          name: dto.name,
          roId: dto.roId,
          komponenId: dto.komponenId,
          jenis: dto.jenis as any,
          masaPelaksanaan: dto.masaPelaksanaan as any,
          dokLingStatus: dto.dokLingStatus,
          indikatorRoId: dto.indikatorRoId,
        },
        include: paketDetailInclude,
      });
    });

    await this.invalidateProyek(dto.proyekId);
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
        dokLingStatus: dto.dokLingStatus,
        indikatorRoId: dto.indikatorRoId,
      },
      include: paketDetailInclude,
    });

    await this.invalidateProyek(paket.proyekId);
    return updated;
  }

  async remove(id: string) {
    const paket = await this.prisma.paket.findUnique({ where: { id } });
    if (!paket) throw new NotFoundException('Paket tidak ditemukan');
    // Soft delete, konsisten dengan Proyek.deletedAt
    await this.prisma.paket.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.invalidateProyek(paket.proyekId);
    return { message: 'Paket berhasil dihapus' };
  }
}
