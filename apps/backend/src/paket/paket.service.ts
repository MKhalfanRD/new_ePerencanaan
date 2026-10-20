import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cekSaldoKegiatan } from '../saldo-kegiatan/saldo';
import { cekBolehUbah } from '../proyek/alur-status';
import { SUMBER } from '../saldo-kegiatan/saldo';
import { RealisasiDto } from './dto/realisasi.dto';
import { catatRiwayat, potretProyek } from '../proyek/riwayat';
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
  cekRoKegiatan,
  cekSaldo,
  kolomPaket,
  lintasUnit,
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
  satker: { select: { id: true, name: true } },
  indikatorRo: {
    include: { indikatorRo: { include: { satuanList: { include: { satuan: true } } } } },
    orderBy: { order: 'asc' as const },
  },
  formValues: { include: { item: true, option: true } },
  alokasi: {
    include: { lokasi: true, komponen: true },
    orderBy: [{ tahun: 'asc' as const }, { status: 'asc' as const }],
  },
  // PKPN/ISP/ISK/Tematik sengaja tidak di-include — pindah ke Proyek (lihat
  // schema.prisma & CreateProyekDto).
};

const ringkasInclude = {
  ro: { select: { satuan: { select: { name: true } } } },
  indikatorRo: { select: { satuan: true } },
  alokasi: {
    select: {
      status: true,
      total: true,
      outputTarget: true,
      outcomeTarget: true,
      komponen: { select: { jenis: true } },
    },
  },
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
    proyek: { id: string; saldoVolumeRo: unknown; saldoVolumeIro: unknown },
    dto: CreatePaketDto | UpdatePaketDto,
    kecualiPaketId?: string,
  ) {
    const lain = await tx.paket.findMany({
      where: { proyekId: proyek.id, deletedAt: null, id: kecualiPaketId ? { not: kecualiPaketId } : undefined },
      include: ringkasInclude,
    });
    cekSaldo(proyek, [...lain.flatMap(paketRingkasDb), ...(await ringkasIsian(tx, dto as CreatePaketDto))]);
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
    cekBolehUbah(proyek.status);
    cekIsianPaket(dto);
    const sebelum = await potretProyek(this.prisma, proyek.id);

    const result = await this.prisma.$transaction(async (tx) => {
      await cekRoKegiatan(tx, proyek.kegiatanId, [dto.roId]);
      dto.satkerId = await satkerPaket(tx, user, proyek.balaiId, dto.satkerId);
      await this.cekSaldoProyek(tx, proyek, dto);
      await cekSaldoKegiatan(tx, proyek.kegiatanId, [], dto.alokasi ?? []);
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
    await catatRiwayat(this.prisma, { proyekId: dto.proyekId, userId: user?.userId, aksi: 'Tambah paket', sebelum });
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
    cekBolehUbah(paket.proyek.status);
    const sebelum = await potretProyek(this.prisma, paket.proyekId);
    // PATCH sebagian: kolom yang tidak dikirim tetap nilai lama.
    const lama = {
      name: paket.name,
      roId: paket.roId,
      satkerId: paket.satkerId ?? undefined,
      lokasiRo: paket.lokasiRo,
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
      await cekRoKegiatan(tx, paket.proyek.kegiatanId, [isian.roId]);
      isian.satkerId = await satkerPaket(tx, user, paket.proyek.balaiId, isian.satkerId);
      if (dto.alokasi !== undefined) {
        await this.cekSaldoProyek(tx, paket.proyek, isian, id);
        await this.cekRencanaVsRealisasi(tx, id, dto.alokasi);
        const lama = await tx.alokasi.findMany({ where: { paketId: id, status: 'RENCANA' } });
        await cekSaldoKegiatan(tx, paket.proyek.kegiatanId, lama, dto.alokasi);
      }
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
    await catatRiwayat(this.prisma, { proyekId: paket.proyekId, userId: user?.userId, aksi: 'Edit paket', sebelum });
    return updated;
  }

  /** Rencana tidak boleh di bawah realisasi yang sudah diisi (flowchart-realisasi.pdf). */
  private async cekRencanaVsRealisasi(
    tx: Prisma.TransactionClient,
    paketId: string,
    alokasi: NonNullable<UpdatePaketDto['alokasi']>,
  ) {
    const realisasi = await tx.alokasi.findMany({ where: { paketId, status: 'REALISASI' } });
    const salah: string[] = [];
    for (const r of realisasi) {
      const baru = alokasi.find((a) => a.tahun === r.tahun);
      if (!baru) {
        salah.push(`Tahun ${r.tahun} sudah punya realisasi; kosongkan realisasinya dulu sebelum menghapus tahun ini`);
        continue;
      }
      for (const k of SUMBER)
        if (Number(baru[k] ?? 0) < Number(r[k]))
          salah.push(`Rencana ${k.toUpperCase()} ${r.tahun} tidak boleh di bawah realisasinya (Rp ${Number(r[k]).toLocaleString('id-ID')})`);
    }
    if (salah.length) throw new BadRequestException(salah.join('; '));
  }

  /**
   * Isi/ubah realisasi 1 tahun. Admin: semua status. Pengisi: hanya proyek
   * Disetujui & paket yang boleh ia ubah. Tiap sumber dana <= rencananya.
   */
  async simpanRealisasi(id: string, dto: RealisasiDto, user?: any) {
    const paket = await this.paketDanProyek(id);
    if (!lintasUnit(user)) {
      cekAksesPaket(user, paket.proyek, paket.satkerId);
      if (paket.proyek.status !== 'APPROVED')
        throw new ForbiddenException('Realisasi diisi setelah proyek disetujui');
    }
    const rencana = await this.prisma.alokasi.findUnique({
      where: { paketId_tahun_status: { paketId: id, tahun: dto.tahun, status: 'RENCANA' } },
    });
    if (!rencana) throw new BadRequestException(`Tahun ${dto.tahun} tidak ada di rencana paket ini`);
    const sebelum = await potretProyek(this.prisma, paket.proyekId);

    const nilai = Object.fromEntries(SUMBER.map((k) => [k, Number(dto[k] ?? 0)])) as Record<
      (typeof SUMBER)[number],
      number
    >;
    const lebih = SUMBER.filter((k) => nilai[k] > Number(rencana[k])).map(
      (k) =>
        `${k.toUpperCase()} Rp ${nilai[k].toLocaleString('id-ID')} melebihi rencana Rp ${Number(rencana[k]).toLocaleString('id-ID')}`,
    );
    if (lebih.length) throw new BadRequestException(`Realisasi ${dto.tahun}: ${lebih.join('; ')}`);

    const total = SUMBER.reduce((s, k) => s + nilai[k], 0);
    const where = { paketId_tahun_status: { paketId: id, tahun: dto.tahun, status: 'REALISASI' as const } };
    if (total === 0) await this.prisma.alokasi.deleteMany({ where: { paketId: id, tahun: dto.tahun, status: 'REALISASI' } });
    else
      await this.prisma.alokasi.upsert({
        where,
        create: { paketId: id, tahun: dto.tahun, status: 'REALISASI', ...nilai, total },
        update: { ...nilai, total },
      });
    await this.invalidateProyek(paket.proyekId);
    await catatRiwayat(this.prisma, { proyekId: paket.proyekId, userId: user?.userId, aksi: `Realisasi ${dto.tahun}`, sebelum });
    return this.findOne(id);
  }

  async remove(id: string, user?: any) {
    const paket = await this.paketDanProyek(id);
    cekAksesPaket(user, paket.proyek, paket.satkerId);
    cekBolehUbah(paket.proyek.status);
    const sebelum = await potretProyek(this.prisma, paket.proyekId);
    // Soft delete, konsisten dengan Proyek.deletedAt
    await this.prisma.paket.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.invalidateProyek(paket.proyekId);
    await catatRiwayat(this.prisma, { proyekId: paket.proyekId, userId: user?.userId, aksi: `Hapus paket ${paket.name}`, sebelum });
    return { message: 'Paket berhasil dihapus' };
  }
}
