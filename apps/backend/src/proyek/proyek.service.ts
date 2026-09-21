import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateProyekDto } from './dto/create-proyek.dto';
import { UpdateProyekDto } from './dto/update-proyek.dto';
import { QueryProyekDto } from './dto/query-proyek.dto';
import { generateKodeProyek } from '../common/kode-generator';
import { hitungSkorEvaluasi } from './evaluasi-skor';
import { deteksiEvaluasiItemIds, ValuasiRatios } from './evaluasi-deteksi';
import { LINTAS_KEGIATAN, roleEfektif } from '../auth/role';
import { PreviewSkorDto } from './dto/preview-skor.dto';

/** Ringkasan dana/output/outcome satu paket — dipakai untuk rasio Valuasi
 * (lihat hitungRasioValuasi). Diisi dari sumber yang beda-beda tergantung
 * konteks: dto.paket[0] saat create, paket tersimpan saat update, atau
 * body request saat preview. */
interface PaketRingkas {
  totalDana: number;
  outputTarget: number;
  outcomeTarget: number;
}

/** Lengkapi array alokasi nested-create dengan pasangan status (Rencana<->
 * Realisasi) bernilai 0 untuk tahun yang belum punya pasangannya — meniru
 * auto-pairing di AlokasiService.create() supaya tabel alokasi proyek baru
 * selalu lengkap Rencana+Realisasi sejak awal. */
function withPairedAlokasi<T extends { tahun: number; status: string }>(
  alokasi: T[],
): T[] {
  const result = [...alokasi];
  for (const a of alokasi) {
    const pairedStatus = a.status === 'RENCANA' ? 'REALISASI' : 'RENCANA';
    const hasPair = alokasi.some(
      (x) => x.tahun === a.tahun && x.status === pairedStatus,
    );
    if (!hasPair) {
      result.push({
        tahun: a.tahun,
        status: pairedStatus,
      } as T);
    }
  }
  return result;
}

const proyekInclude = Prisma.validator<Prisma.ProyekInclude>()({
  balai: true,
  periode: true,
  createdBy: {
    select: {
      id: true,
      username: true,
      name: true,
      role: { select: { code: true, name: true } },
    },
  },
  paket: {
    where: { deletedAt: null },
    include: {
      ro: {
        include: {
          kro: { include: { kegiatan: { include: { program: true } } } },
          satuan: true,
        },
      },
      komponen: true,
      indikatorRo: {
        include: { satuanList: { include: { satuan: true } } },
      },
      alokasi: {
        include: { lokasi: true },
        orderBy: [
          { tahun: Prisma.SortOrder.asc },
          { status: Prisma.SortOrder.asc },
        ],
      },
    },
    orderBy: { createdAt: Prisma.SortOrder.asc },
  },
  wilayahSungai: true,
  kegiatanPrioritas: {
    include: { programPrioritas: { include: { prioritasNasional: true } } },
  },
  pkpn: true,
  indikatorSasaranProgram: true,
  indikatorSasaranKegiatan: true,
  tematikRenja: true,
  dokumenPendukung: true,
  evaluasi: { include: { item: { include: { metode: true } } } },
});

/**
 * Batas kegiatan yang boleh dilihat/diubah seorang user. SUPER_ADMIN &
 * ADMINISTRATOR lintas kegiatan; role lain WAJIB terikat satu kegiatan
 * (Role.kegiatanId) dan cuma melihat proyek yang punya paket di kegiatan itu.
 */
function filterKegiatan(user: any): Prisma.ProyekWhereInput | null {
  if (LINTAS_KEGIATAN.includes(user?.role)) return null;
  if (!user?.kegiatanId) return null;
  return {
    paket: {
      some: {
        deletedAt: null,
        ro: { kro: { kegiatanId: user.kegiatanId } },
      },
    },
  };
}

@Injectable()
export class ProyekService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Skor evaluasi TIDAK diterima dari client — dideteksi otomatis dari
   * field proyek + kegiatan paket pertama (lihat evaluasi-deteksi.ts).
   * Kegiatan diturunkan dari RO paket pertama karena daftar EvaluasiItem
   * beda per kegiatan (Irwa/Supan/Bendungan/Air Tanah).
   */
  private async hitungEvaluasi(
    tx: Prisma.TransactionClient,
    input: {
      sumberUsulanProyek?: string | null;
      kegiatanPrioritasId?: string | null;
      tahunDed?: number | null;
      tahunDokumenLingkungan?: number | null;
      kebutuhanTanah?: boolean | null;
      kewenangan?: string | null;
      pkpnId?: string | null;
      tematikRenjaId?: string | null;
      taggingDinamis?: string[] | null;
    },
    roIdPaketPertama: string | undefined,
    paketSekarang?: PaketRingkas,
  ): Promise<{
    skorEvaluasi: number | null;
    itemIds: string[];
    keterangan: Record<string, string>;
  }> {
    if (!roIdPaketPertama) {
      return { skorEvaluasi: null, itemIds: [], keterangan: {} };
    }
    const ro = await tx.rO.findUnique({
      where: { id: roIdPaketPertama },
      select: { kro: { select: { kegiatanId: true } } },
    });
    const kegiatanId = ro?.kro.kegiatanId;
    if (!kegiatanId) {
      return { skorEvaluasi: null, itemIds: [], keterangan: {} };
    }

    const [semuaItem, metodeList, tematikRenja] = await Promise.all([
      tx.evaluasiItem.findMany({
        where: { kegiatanId },
        select: { id: true, name: true, metodeId: true, score: true },
      }),
      tx.metodeEvaluasi.findMany({ select: { id: true, bobot: true } }),
      input.tematikRenjaId
        ? tx.tematikRenja.findUnique({ where: { id: input.tematikRenjaId } })
        : null,
    ]);

    const valuasi = await this.hitungRasioValuasi(
      tx,
      kegiatanId,
      paketSekarang,
    );

    const { itemIds, keterangan } = deteksiEvaluasiItemIds(
      {
        sumberUsulanProyek: input.sumberUsulanProyek,
        kegiatanPrioritasId: input.kegiatanPrioritasId,
        tahunDed: input.tahunDed,
        tahunDokumenLingkungan: input.tahunDokumenLingkungan,
        kebutuhanTanah: input.kebutuhanTanah,
        kewenangan: input.kewenangan,
        pkpnId: input.pkpnId,
        tematikRenjaName: tematikRenja?.name,
        taggingDinamis: input.taggingDinamis,
      },
      semuaItem,
      valuasi,
    );

    const bobotMetode = new Map(metodeList.map((m) => [m.id, m.bobot]));
    const dicentang = semuaItem.filter((i) => itemIds.includes(i.id));
    const skorEvaluasi = hitungSkorEvaluasi(semuaItem, dicentang, bobotMetode);

    return { skorEvaluasi, itemIds, keterangan };
  }

  /** Rasio dana/output/outcome paket ini dibanding rata-rata paket lain di
   * kegiatan yang sama — dipakai 3 item Valuasi ("Rasio anggaran terhadap
   * output/outcome", "Rasio Output terhadap Outcome"). Item Valuasi lain
   * (multiguna, luas baku sawah, dst.) sengaja tidak dihitung — tidak ada
   * data pendukungnya di skema saat ini.
   *
   * `paketSekarang` diterima langsung dari pemanggil (bukan di-query lewat
   * roId di sini) — paket yang baru dibuat/di-preview belum tentu ada di DB,
   * dan query by roId bisa nyasar ke paket proyek LAIN yang kebetulan pakai
   * RO yang sama. */
  private async hitungRasioValuasi(
    tx: Prisma.TransactionClient,
    kegiatanId: string,
    paketSekarang: PaketRingkas | undefined,
  ): Promise<ValuasiRatios> {
    const paketLain = await tx.paket.findMany({
      where: { ro: { kro: { kegiatanId } }, deletedAt: null },
      select: {
        alokasi: {
          select: { total: true, outputTarget: true, outcomeTarget: true },
        },
      },
    });

    const ratio = (
      p: { alokasi: { total: any; outputTarget: any; outcomeTarget: any }[] },
      key: 'outputTarget' | 'outcomeTarget',
    ) => {
      const totalDana = p.alokasi.reduce((s, a) => s + Number(a.total), 0);
      const totalTarget = p.alokasi.reduce(
        (s, a) => s + Number(a[key] ?? 0),
        0,
      );
      return totalTarget > 0 ? totalDana / totalTarget : null;
    };
    const ratioOutputOutcome = (p: {
      alokasi: { outputTarget: any; outcomeTarget: any }[];
    }) => {
      const output = p.alokasi.reduce(
        (s, a) => s + Number(a.outputTarget ?? 0),
        0,
      );
      const outcome = p.alokasi.reduce(
        (s, a) => s + Number(a.outcomeTarget ?? 0),
        0,
      );
      return outcome > 0 ? output / outcome : null;
    };

    const rata = (nilai: (number | null)[]) => {
      const valid = nilai.filter((n): n is number => n != null);
      return valid.length
        ? valid.reduce((s, n) => s + n, 0) / valid.length
        : null;
    };

    if (!paketSekarang) {
      return {};
    }
    const { totalDana, outputTarget, outcomeTarget } = paketSekarang;
    return {
      danaPerOutput: outputTarget > 0 ? totalDana / outputTarget : null,
      danaPerOutcome: outcomeTarget > 0 ? totalDana / outcomeTarget : null,
      outputPerOutcome: outcomeTarget > 0 ? outputTarget / outcomeTarget : null,
      rataDanaPerOutput: rata(paketLain.map((p) => ratio(p, 'outputTarget'))),
      rataDanaPerOutcome: rata(paketLain.map((p) => ratio(p, 'outcomeTarget'))),
      rataOutputPerOutcome: rata(paketLain.map(ratioOutputOutcome)),
    };
  }

  /** Preview skor evaluasi tanpa menyimpan apa pun — dipakai form Proyek
   * (create maupun edit) supaya tab Evaluasi ter-update live. Reload
   * EvaluasiItem untuk itemIds hasil deteksi supaya breakdown per-metode
   * bisa ditampilkan tanpa proyek harus tersimpan dulu. */
  async previewEvaluasi(dto: PreviewSkorDto) {
    const paketSekarang: PaketRingkas | undefined =
      dto.totalDana != null ||
      dto.outputTarget != null ||
      dto.outcomeTarget != null
        ? {
            totalDana: dto.totalDana ?? 0,
            outputTarget: dto.outputTarget ?? 0,
            outcomeTarget: dto.outcomeTarget ?? 0,
          }
        : undefined;

    const { skorEvaluasi, itemIds, keterangan } = await this.hitungEvaluasi(
      this.prisma,
      dto,
      dto.roId,
      paketSekarang,
    );

    if (!itemIds.length) {
      return { skorEvaluasi, items: [] };
    }
    const items = await this.prisma.evaluasiItem.findMany({
      where: { id: { in: itemIds } },
      include: { metode: true },
    });
    return {
      skorEvaluasi,
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        metodeName: i.metode.name,
        keterangan: keterangan[i.id],
      })),
    };
  }

  async create(dto: CreateProyekDto, userId: string, userRole?: string) {
    if (dto.paket?.length && userRole !== 'ADMINISTRATOR') {
      const balai = await this.prisma.balai.findUnique({
        where: { id: dto.balaiId },
        select: { isActive: true },
      });
      if (!balai?.isActive) {
        throw new ForbiddenException(
          'Balai ini sedang dinonaktifkan oleh admin, tidak bisa membuat paket baru',
        );
      }
    }

    const proyek = await this.prisma.$transaction(async (tx) => {
      // Kode Proyek & Kode Paket digenerate otomatis, tidak lagi diisi
      // manual — lihat src/common/kode-generator.ts.
      const kodeProyek = await generateKodeProyek(tx);
      const proyekPart = kodeProyek.slice(2);

      const paket0 = dto.paket?.[0];
      const alokasi0 = paket0?.alokasi?.[0];
      const paketSekarang: PaketRingkas | undefined = alokasi0
        ? {
            totalDana:
              (alokasi0.rm ?? 0) +
              (alokasi0.rmp ?? 0) +
              (alokasi0.pln ?? 0) +
              (alokasi0.sbsn ?? 0) +
              (alokasi0.kpbu ?? 0),
            outputTarget: alokasi0.outputTarget ?? 0,
            outcomeTarget: alokasi0.outcomeTarget ?? 0,
          }
        : undefined;
      const { skorEvaluasi, itemIds, keterangan } = await this.hitungEvaluasi(
        tx,
        dto,
        paket0?.roId,
        paketSekarang,
      );

      return tx.proyek.create({
        data: {
          balaiId: dto.balaiId,
          periodeId: dto.periodeId,
          kodeProyek,
          projectName: dto.projectName,
          kewenangan: (dto.kewenangan ?? 'PUSAT') as any,
          provinceId: dto.provinceId,
          cityId: dto.cityId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          kebutuhanTanah: dto.kebutuhanTanah ?? false,
          wilayahSungaiId: dto.wilayahSungaiId,
          kegiatanPrioritasId: dto.kegiatanPrioritasId,
          skorEvaluasi,
          evaluasi: itemIds.length
            ? {
                create: itemIds.map((itemId) => ({
                  itemId,
                  keterangan: keterangan[itemId] || undefined,
                })),
              }
            : undefined,
          tahunStudiLayak: dto.tahunStudiLayak,
          statusStudiLayak: dto.statusStudiLayak as any,
          tahunDed: dto.tahunDed,
          statusDed: dto.statusDed as any,
          tahunLarap: dto.tahunLarap,
          statusLarap: dto.statusLarap as any,
          tahunDokumenLingkungan: dto.tahunDokumenLingkungan,
          statusDokumenLingkungan: dto.statusDokumenLingkungan as any,
          sumberUsulanProyek: dto.sumberUsulanProyek,
          sumberUsulanLainnya: dto.sumberUsulanLainnya,
          justifikasiProyek: dto.justifikasiProyek,
          pkpnId: dto.pkpnId,
          indikatorSasaranProgramId: dto.indikatorSasaranProgramId,
          indikatorSasaranKegiatanId: dto.indikatorSasaranKegiatanId,
          tematikRenjaId: dto.tematikRenjaId,
          fkb: dto.fkb ?? false,
          fkw: dto.fkw ?? false,
          mpa: dto.mpa ?? false,
          taggingDinamis: dto.taggingDinamis ?? [],
          catatanPembina: dto.catatanPembina,
          catatanSspsda: dto.catatanSspsda,
          status: 'APPROVED',
          createdById: userId,

          paket: dto.paket
            ? {
                create: dto.paket.map((p, idx) => ({
                  kodePaket: `PA${proyekPart}${String(idx + 1).padStart(4, '0')}`,
                  name: p.name,
                  roId: p.roId,
                  komponenId: p.komponenId,
                  jenis: p.jenis as any,
                  masaPelaksanaan: p.masaPelaksanaan as any,
                  dokLingStatus: p.dokLingStatus,
                  indikatorRoId: p.indikatorRoId,

                  alokasi: p.alokasi
                    ? {
                        // Sertakan pasangan Rencana/Realisasi bernilai 0 kalau
                        // belum ada — konsisten dengan AlokasiService.create(),
                        // supaya tabel alokasi selalu lengkap tanpa perlu
                        // "Tambah Alokasi" manual lagi setelah proyek dibuat.
                        create: withPairedAlokasi(p.alokasi).map((a) => ({
                          tahun: a.tahun,
                          status: a.status as any,
                          rm: a.rm ?? 0,
                          rmp: a.rmp ?? 0,
                          pln: a.pln ?? 0,
                          sbsn: a.sbsn ?? 0,
                          kpbu: a.kpbu ?? 0,
                          total:
                            (a.rm ?? 0) +
                            (a.rmp ?? 0) +
                            (a.pln ?? 0) +
                            (a.sbsn ?? 0) +
                            (a.kpbu ?? 0),
                          outputTarget: a.outputTarget,
                          outputUnit: a.outputUnit,
                          outcomeTarget: a.outcomeTarget,
                          outcomeUnit: a.outcomeUnit,
                          catatan: a.catatan,
                        })),
                      }
                    : undefined,
                })),
              }
            : undefined,
        },
        include: proyekInclude,
      });
    });

    await this.redis.delByPrefix('proyek:list:');
    return proyek;
  }

  async findAll(user: any, query: QueryProyekDto) {
    const { status, page = 1, limit = 10, search, periodeId } = query;
    const skip = (page - 1) * limit;

    const cacheKey = `proyek:list:${user.userId}:${user.role}:${user.kegiatanId ?? ''}:${status ?? ''}:${page}:${limit}:${search ?? ''}:${periodeId ?? ''}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const where: Prisma.ProyekWhereInput = {};

    // Verifikator (termasuk role turunannya, mis. VERIFIKATOR_7691) melihat
    // semua proyek dalam cakupannya, bukan cuma buatannya sendiri.
    if (
      !LINTAS_KEGIATAN.includes(user.role) &&
      roleEfektif(user) !== 'VERIFICATOR'
    ) {
      where.createdById = user.userId;
    }
    // Role yang terikat 1 kegiatan (mis. operator 7691) tidak boleh melihat
    // proyek kegiatan lain, termasuk VERIFICATOR.
    const scope = filterKegiatan(user);
    if (scope) Object.assign(where, scope);
    if (status) where.status = status as any;
    if (periodeId) where.periodeId = Number(periodeId);
    if (search) where.projectName = { contains: search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.proyek.findMany({
        where,
        include: proyekInclude,
        orderBy: { createdAt: Prisma.SortOrder.desc },
        skip,
        take: limit,
      }),
      this.prisma.proyek.count({ where }),
    ]);

    const result = {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };

    await this.redis.setWithPrefix('proyek:list:', cacheKey, result, 60);
    return result;
  }

  async findOne(id: string, user: any) {
    const cacheKey = `proyek:${id}`;
    // Cache dipakai sebagai sumber data, TAPI otorisasi di bawah tetap
    // jalan untuk hasil cache — jangan pernah return lebih awal di sini.
    const proyek: any =
      (await this.redis.get(cacheKey)) ??
      (await this.prisma.proyek.findUnique({
        where: { id },
        include: proyekInclude,
      }));

    if (!proyek) throw new NotFoundException('Proyek tidak ditemukan');

    if (
      !LINTAS_KEGIATAN.includes(user.role) &&
      roleEfektif(user) !== 'VERIFICATOR' &&
      proyek.createdById !== user.userId
    ) {
      throw new ForbiddenException('Anda tidak memiliki akses ke proyek ini');
    }

    // Role terikat kegiatan: proyek di luar kegiatannya tidak boleh dibuka
    // walaupun dia yang membuat (mis. setelah role-nya dipindah).
    if (
      !LINTAS_KEGIATAN.includes(user.role) &&
      user.kegiatanId &&
      !proyek.paket.some((pk) => pk.ro.kro.kegiatanId === user.kegiatanId)
    ) {
      throw new ForbiddenException(
        'Proyek ini di luar kegiatan yang Anda tangani',
      );
    }

    await this.redis.set(cacheKey, proyek, 300);
    return proyek;
  }

  /** Status proyek cuma DRAFT & APPROVED — tidak ada alur submit/review lagi. */
  async approve(id: string) {
    const proyek = await this.prisma.proyek.findUnique({ where: { id } });
    if (!proyek) throw new NotFoundException('Proyek tidak ditemukan');
    if (proyek.status !== 'DRAFT') {
      throw new BadRequestException(
        'Hanya proyek berstatus DRAFT yang dapat disetujui',
      );
    }

    const updated = await this.prisma.proyek.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: proyekInclude,
    });

    await this.invalidateCache(id);
    return updated;
  }

  /** Kembalikan proyek yang APPROVED ke DRAFT (mis. salah setuju / perlu revisi lagi). */
  async unapprove(id: string) {
    const proyek = await this.prisma.proyek.findUnique({ where: { id } });
    if (!proyek) throw new NotFoundException('Proyek tidak ditemukan');
    if (proyek.status !== 'APPROVED') {
      throw new BadRequestException(
        'Hanya proyek berstatus APPROVED yang dapat dikembalikan ke draft',
      );
    }

    const updated = await this.prisma.proyek.update({
      where: { id },
      data: { status: 'DRAFT' },
      include: proyekInclude,
    });

    await this.invalidateCache(id);
    return updated;
  }

  async update(id: string, dto: UpdateProyekDto, user: any) {
    const proyek = await this.prisma.proyek.findUnique({
      where: { id },
      include: {
        paket: {
          orderBy: { createdAt: Prisma.SortOrder.asc },
          take: 1,
          include: {
            alokasi: {
              select: { total: true, outputTarget: true, outcomeTarget: true },
            },
          },
        },
      },
    });
    if (!proyek) throw new NotFoundException('Proyek tidak ditemukan');
    if (
      !LINTAS_KEGIATAN.includes(user.role) &&
      proyek.createdById !== user.userId
    )
      throw new ForbiddenException('Bukan proyek milik anda');

    const paket0 = proyek.paket?.[0];
    const paketSekarang: PaketRingkas | undefined = paket0
      ? {
          totalDana: paket0.alokasi.reduce((s, a) => s + Number(a.total), 0),
          outputTarget: paket0.alokasi.reduce(
            (s, a) => s + Number(a.outputTarget ?? 0),
            0,
          ),
          outcomeTarget: paket0.alokasi.reduce(
            (s, a) => s + Number(a.outcomeTarget ?? 0),
            0,
          ),
        }
      : undefined;

    // Skor evaluasi dihitung ulang tiap kali proyek disimpan — tidak ada
    // lagi "kirim = ganti, tidak dikirim = biarkan", karena field ini sudah
    // tidak diterima dari client sama sekali (lihat evaluasi-deteksi.ts).
    // Bukan $transaction — cuma pembacaan sebelum satu nested-write .update().
    const { skorEvaluasi, itemIds, keterangan } = await this.hitungEvaluasi(
      this.prisma,
      { ...proyek, ...dto },
      paket0?.roId,
      paketSekarang,
    );

    const updated = await this.prisma.proyek.update({
      where: { id },
      data: {
        // kodeProyek sengaja tidak diikutkan — permanen sejak dibuat.
        skorEvaluasi,
        evaluasi: {
          deleteMany: {},
          create: itemIds.map((itemId) => ({
            itemId,
            keterangan: keterangan[itemId] || undefined,
          })),
        },
        balaiId: dto.balaiId,
        periodeId: dto.periodeId,
        projectName: dto.projectName,
        kewenangan: dto.kewenangan as any,
        provinceId: dto.provinceId,
        cityId: dto.cityId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        kebutuhanTanah: dto.kebutuhanTanah,
        wilayahSungaiId: dto.wilayahSungaiId,
        kegiatanPrioritasId: dto.kegiatanPrioritasId,
        tahunStudiLayak: dto.tahunStudiLayak,
        statusStudiLayak: dto.statusStudiLayak as any,
        tahunDed: dto.tahunDed,
        statusDed: dto.statusDed as any,
        tahunLarap: dto.tahunLarap,
        statusLarap: dto.statusLarap as any,
        tahunDokumenLingkungan: dto.tahunDokumenLingkungan,
        statusDokumenLingkungan: dto.statusDokumenLingkungan as any,
        sumberUsulanProyek: dto.sumberUsulanProyek,
        sumberUsulanLainnya: dto.sumberUsulanLainnya,
        justifikasiProyek: dto.justifikasiProyek,
        pkpnId: dto.pkpnId,
        indikatorSasaranProgramId: dto.indikatorSasaranProgramId,
        indikatorSasaranKegiatanId: dto.indikatorSasaranKegiatanId,
        tematikRenjaId: dto.tematikRenjaId,
        fkb: dto.fkb,
        fkw: dto.fkw,
        mpa: dto.mpa,
        taggingDinamis: dto.taggingDinamis,
        catatanPembina: dto.catatanPembina,
        catatanSspsda: dto.catatanSspsda,
      },
      include: proyekInclude,
    });

    await this.invalidateCache(id);
    return updated;
  }

  async remove(id: string, user: any) {
    const proyek = await this.prisma.proyek.findUnique({ where: { id } });
    if (!proyek) throw new NotFoundException('Proyek tidak ditemukan');
    if (
      !LINTAS_KEGIATAN.includes(user.role) &&
      proyek.createdById !== user.userId
    ) {
      throw new ForbiddenException('Bukan proyek milik anda');
    }

    await this.prisma.proyek.delete({ where: { id } });
    await this.invalidateCache(id);
    return { message: 'Proyek berhasil dihapus' };
  }

  async tambahDokumen(
    proyekId: string,
    files: Express.Multer.File[],
    userId: string,
  ) {
    const proyek = await this.prisma.proyek.findUnique({
      where: { id: proyekId },
    });
    if (!proyek) throw new NotFoundException('Proyek tidak ditemukan');
    if (!files?.length) {
      throw new BadRequestException('Tidak ada file yang diupload');
    }

    const created = await this.prisma.dokumenPendukung.createMany({
      data: files.map((f) => ({
        proyekId,
        fileName: f.originalname,
        // Path relatif terhadap folder uploads/ — disajikan statis di
        // /uploads/... (lihat app.useStaticAssets di main.ts).
        filePath: `proyek/${proyekId}/${f.filename}`,
        mimeType: f.mimetype,
        size: f.size,
        uploadedById: userId,
      })),
    });

    await this.invalidateCache(proyekId);
    return created;
  }

  async hapusDokumen(docId: string) {
    const dokumen = await this.prisma.dokumenPendukung.findUnique({
      where: { id: docId },
    });
    if (!dokumen) throw new NotFoundException('Dokumen tidak ditemukan');

    await this.prisma.dokumenPendukung.delete({ where: { id: docId } });
    await unlink(join(process.cwd(), 'uploads', dokumen.filePath)).catch(
      () => undefined, // file fisik sudah hilang duluan — bukan error fatal
    );
    await this.invalidateCache(dokumen.proyekId);
    return { message: 'Dokumen berhasil dihapus' };
  }

  private async invalidateCache(id: string) {
    await this.redis.del(`proyek:${id}`);
    await this.redis.delByPrefix('proyek:list:');
  }
}
