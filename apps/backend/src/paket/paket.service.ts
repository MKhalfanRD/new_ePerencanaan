import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreatePaketDto } from './dto/create-paket.dto';
import { UpdatePaketDto } from './dto/update-paket.dto';
import {
  generateKodeProyek,
  generateKodePaket,
} from '../common/kode-generator';
import { paketFormValueRows } from '../common/form-value-rows';
import { paketRingkasDb } from '../proyek/form-skor';
import {
  cekAksesPaket,
  cekIsianPaket,
  cekSaldo,
  kolomPaket,
  relasiPaketBaru,
  ringkasIsian,
  satkerPaket,
  simpanRelasiPaket,
} from './paket-data';

export const paketDetailInclude = {
  proyek: { select: { id: true, projectName: true, status: true } },
  ro: {
    include: {
      kro: { include: { kegiatan: { include: { program: true } } } },
      satuan: true,
    },
  },
  komponen: true,
  satker: { select: { id: true, name: true } },
  indikatorRo: {
    include: { indikatorRo: { include: { satuanList: { include: { satuan: true } } } } },
    orderBy: { order: 'asc' as const },
  },
  formValues: { include: { item: true, option: true } },
  alokasi: {
    include: { lokasi: true },
    orderBy: [{ tahun: 'asc' as const }, { status: 'asc' as const }],
  },
  // PKPN/ISP/ISK/Tematik sengaja tidak di-include — pindah ke Proyek (lihat
  // schema.prisma & CreateProyekDto).
};

const ringkasInclude = {
  komponen: { select: { jenis: true } },
  indikatorRo: { select: { volume: true } },
  alokasi: { select: { status: true, total: true } },
} satisfies Prisma.PaketInclude;

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

  /** Saldo proyek vs paket lain + paket yang sedang disimpan. */
  private async cekSaldoProyek(
    tx: Prisma.TransactionClient,
    proyek: { id: string; saldoAnggaran: unknown; saldoVolumeRo: unknown; saldoVolumeIro: unknown },
    dto: CreatePaketDto | UpdatePaketDto,
    kecualiPaketId?: string,
  ) {
    const lain = await tx.paket.findMany({
      where: { proyekId: proyek.id, deletedAt: null, id: kecualiPaketId ? { not: kecualiPaketId } : undefined },
      include: ringkasInclude,
    });
    cekSaldo(proyek, [...lain.map(paketRingkasDb), await ringkasIsian(tx, dto as CreatePaketDto)]);
  }

  async create(dto: CreatePaketDto, user?: any) {
    const proyek = await this.prisma.proyek.findUnique({
      where: { id: dto.proyekId },
      include: { balai: { select: { isActive: true } } },
    });
    if (!proyek) throw new NotFoundException('Proyek tidak ditemukan');
    // ADMINISTRATOR tidak terkena batasan — flag ini cuma membatasi SATKER
    // balai yang dinonaktifkan admin.
    if (!proyek.balai?.isActive && user?.role !== 'ADMINISTRATOR') {
      throw new ForbiddenException(
        'Balai ini sedang dinonaktifkan oleh admin, tidak bisa membuat paket baru',
      );
    }
    cekAksesPaket(user, proyek);
    cekIsianPaket(dto);

    const result = await this.prisma.$transaction(async (tx) => {
      dto.satkerId = await satkerPaket(tx, user, proyek.balaiId, dto.satkerId);
      await this.cekSaldoProyek(tx, proyek, dto);
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
      const formValues = await paketFormValueRows(tx, dto.roId, dto.formValues);

      return tx.paket.create({
        data: {
          proyekId: dto.proyekId,
          kodePaket,
          ...kolomPaket(dto),
          ...relasiPaketBaru(dto),
          formValues: formValues.length ? { create: formValues } : undefined,
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

  private async paketDanProyek(id: string) {
    const paket = await this.prisma.paket.findUnique({
      where: { id },
      include: { proyek: true },
    });
    if (!paket || paket.deletedAt) throw new NotFoundException('Paket tidak ditemukan');
    return paket;
  }

  async update(id: string, dto: UpdatePaketDto, user?: any) {
    const paket = await this.paketDanProyek(id);
    cekAksesPaket(user, paket.proyek, paket.satkerId);
    // PATCH sebagian: kolom yang tidak dikirim tetap nilai lama.
    const lama = {
      name: paket.name,
      roId: paket.roId,
      komponenId: paket.komponenId ?? undefined,
      satkerId: paket.satkerId ?? undefined,
      lokasiRo: paket.lokasiRo,
      volumeRo: paket.volumeRo == null ? undefined : Number(paket.volumeRo),
      tahunMulai: paket.tahunMulai ?? undefined,
      tahunSelesai: paket.tahunSelesai ?? undefined,
      lokasiSamaProyek: paket.lokasiSamaProyek,
      tipeKoordinat: paket.tipeKoordinat ?? undefined,
      latitude: paket.latitude ?? undefined,
      longitude: paket.longitude ?? undefined,
      coordinates: (paket.coordinates as number[][] | null) ?? undefined,
      provinceId: paket.provinceId ?? undefined,
      provinceName: paket.provinceName ?? undefined,
      cityId: paket.cityId ?? undefined,
      cityName: paket.cityName ?? undefined,
      districtId: paket.districtId ?? undefined,
      districtName: paket.districtName ?? undefined,
      villageId: paket.villageId ?? undefined,
      villageName: paket.villageName ?? undefined,
    };
    const isian = {
      ...lama,
      ...Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)),
    } as UpdatePaketDto & { name: string; roId: string };
    cekIsianPaket(isian);

    const updated = await this.prisma.$transaction(async (tx) => {
      isian.satkerId = await satkerPaket(tx, user, paket.proyek.balaiId, isian.satkerId);
      if (dto.alokasi !== undefined || dto.volumeRo !== undefined || dto.indikatorRo !== undefined)
        await this.cekSaldoProyek(tx, paket.proyek, isian, id);
      await simpanRelasiPaket(tx, id, isian);
      // formValues tidak dikirim = jangan sentuh isian lama.
      const formValues =
        dto.formValues === undefined
          ? undefined
          : {
              deleteMany: {},
              create: await paketFormValueRows(tx, isian.roId, dto.formValues),
            };
      return tx.paket.update({
        where: { id },
        // kodePaket sengaja tidak diikutkan — dibuat sekali saat create.
        data: { formValues, ...kolomPaket(isian) },
        include: paketDetailInclude,
      });
    });

    await this.invalidateProyek(paket.proyekId);
    return updated;
  }

  async remove(id: string, user?: any) {
    const paket = await this.paketDanProyek(id);
    cekAksesPaket(user, paket.proyek, paket.satkerId);
    // Soft delete, konsisten dengan Proyek.deletedAt
    await this.prisma.paket.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.invalidateProyek(paket.proyekId);
    return { message: 'Paket berhasil dihapus' };
  }
}
