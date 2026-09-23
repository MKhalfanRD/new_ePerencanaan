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
import {
  hitungSkorEvaluasi,
  ScoringTabDef,
  ItemValueLookup,
} from './form-skor';
import { LINTAS_KEGIATAN, roleEfektif } from '../auth/role';
import { PreviewSkorDto, FormValueDto } from './dto/preview-skor.dto';

interface ValuasiRatios {
  danaPerOutput?: number | null;
  danaPerOutcome?: number | null;
  outputPerOutcome?: number | null;
}

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
  formValues: { include: { item: true, option: true } },
});

/** FormItem.key yang dibackup kolom Proyek tetap — nilainya dibaca langsung
 * dari input, TIDAK disimpan lagi ke ProyekFormValue (sudah ada tempatnya).
 * Dipertahankan supaya admin bisa nonaktifkan/atur score-nya di tab Dasar
 * Pelaksanaan/Kesiapan Teknis/Tematik tanpa nambah tabel baru. */
const FIXED_ITEM_KEYS = new Set([
  'sumberUsulanProyek',
  'statusStudiLayak',
  'statusDed',
  'statusLarap',
  'statusDokumenLingkungan',
  'kewenangan',
  'kebutuhanTanah',
  'kegiatanPrioritasId',
  'pkpnId',
  'indikatorSasaranProgramId',
  'indikatorSasaranKegiatanId',
  'tematikRenjaId',
  'fkb',
  'fkw',
  'mpa',
  'taggingDinamis',
]);

/** FormItem.key rasio Valuasi -> field ValuasiRatios yang jadi nilai
 * pembandingnya (lihat FormItem.thresholdValue & form-skor.ts). */
const RATIO_ITEM_KEYS: Record<string, keyof ValuasiRatios> = {
  rasioAnggaranOutput: 'danaPerOutput',
  rasioAnggaranOutcome: 'danaPerOutcome',
  rasioOutputOutcome: 'outputPerOutcome',
};

const scoringTabInclude = Prisma.validator<Prisma.FormTabInclude>()({
  sections: {
    where: { isActive: true },
    include: {
      items: {
        where: { isActive: true },
        include: { options: { where: { isActive: true } } },
      },
    },
  },
});
type FormTabScoring = Prisma.FormTabGetPayload<{
  include: typeof scoringTabInclude;
}>;

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
   * Skor evaluasi dihitung dari struktur Form Proyek (Master Data) kegiatan
   * paket pertama, bukan lagi checklist tetap (lihat form-skor.ts). Item
   * yang dibackup kolom Proyek tetap (Dasar Pelaksanaan/Kesiapan
   * Teknis/Tematik) nilainya diambil dari `input`; item Valuasi dari rasio
   * dana/output/outcome; sisanya (Kategori Proyek, Kinerja) dari
   * `formValues` yang dikirim client.
   */
  private async hitungEvaluasi(
    tx: Prisma.TransactionClient,
    input: any,
    roIdPaketPertama: string | undefined,
    paketSekarang?: PaketRingkas,
    formValues?: FormValueDto[],
    // Proyek yang SUDAH ada (edit, atau recalc setelah upload) — dipakai
    // buat cek field UPLOAD ("terisi" = ada DokumenPendukung, bukan dari
    // formValues yang memang tidak pernah membawa file). undefined saat
    // proyek baru pertama kali dibuat (belum punya id, belum ada file).
    proyekIdUntukUpload?: string,
  ): Promise<{
    skorEvaluasi: number | null;
    formValueCreates: Prisma.ProyekFormValueCreateManyProyekInput[];
  }> {
    if (!roIdPaketPertama) {
      return { skorEvaluasi: null, formValueCreates: [] };
    }
    const ro = await tx.rO.findUnique({
      where: { id: roIdPaketPertama },
      select: { kro: { select: { kegiatanId: true } } },
    });
    const kegiatanId = ro?.kro.kegiatanId;
    if (!kegiatanId) {
      return { skorEvaluasi: null, formValueCreates: [] };
    }

    const formTabs = await tx.formTab.findMany({
      where: { template: { kegiatanId }, isActive: true, bobot: { not: null } },
      include: scoringTabInclude,
    });
    // Item generik (formValues) bisa ada di TAB APAPUN (termasuk tab
    // struktural non-skoring, mis. Identitas) — query terpisah tanpa filter
    // bobot supaya field tambahan admin di tab manapun tetap tersimpan.
    const allActiveTabs = await tx.formTab.findMany({
      where: { template: { kegiatanId }, isActive: true },
      include: scoringTabInclude,
    });

    const valuasi = this.hitungRasioValuasi(paketSekarang);
    const genericValues = new Map(
      (formValues ?? []).map((f) => [f.key, f.value]),
    );
    const activeConditionValues: Record<string, string> = {};
    for (const f of formValues ?? []) {
      if (typeof f.value === 'string') activeConditionValues[f.key] = f.value;
    }

    const allItems = allActiveTabs.flatMap((t) =>
      t.sections.flatMap((s) => s.items),
    );

    // Field UPLOAD: "terisi" ditentukan dari ada/tidaknya DokumenPendukung
    // yang di-tag ke item ini, bukan dari formValues (yang tidak pernah
    // membawa file — lihat field-control.tsx/proyek-form-dialog.tsx).
    const uploadItemIds = allItems
      .filter((i) => i.fieldType === 'UPLOAD')
      .map((i) => i.id);
    const uploadedKeys = new Set<string>();
    if (proyekIdUntukUpload && uploadItemIds.length) {
      const dokumen = await tx.dokumenPendukung.findMany({
        where: {
          proyekId: proyekIdUntukUpload,
          formItemId: { in: uploadItemIds },
        },
        select: { formItemId: true },
      });
      const uploadedItemIds = new Set(dokumen.map((d) => d.formItemId));
      for (const i of allItems) {
        if (uploadedItemIds.has(i.id)) uploadedKeys.add(i.key);
      }
    }

    const lookup: ItemValueLookup = (key) => {
      if (FIXED_ITEM_KEYS.has(key)) return input[key];
      if (key in RATIO_ITEM_KEYS) return valuasi[RATIO_ITEM_KEYS[key]];
      if (uploadedKeys.has(key)) return true;
      return genericValues.get(key);
    };
    const tabs: ScoringTabDef[] = formTabs.map((t) => ({
      bobot: t.bobot,
      items: t.sections
        .flatMap((s) => s.items)
        .filter(
          (i) =>
            !i.conditionItemId ||
            activeConditionValues[i.conditionItemId] === i.conditionValue,
        )
        .map((i) => ({
          key: i.key,
          score: i.score,
          isActive: true,
          thresholdValue: i.thresholdValue,
          options: i.options.map((o) => ({
            value: o.value,
            score: o.score,
            isActive: true,
          })),
        })),
    }));

    const skorEvaluasi = hitungSkorEvaluasi(tabs, lookup);

    // Simpan cuma item yang BUKAN backed kolom fixed/rasio — itu sudah
    // tersimpan di kolomnya sendiri (mis. Kategori Proyek, item Kinerja).
    const formValueCreates: Prisma.ProyekFormValueCreateManyProyekInput[] =
      [];
    for (const f of formValues ?? []) {
      if (FIXED_ITEM_KEYS.has(f.key) || f.key in RATIO_ITEM_KEYS) continue;
      const item = allItems.find((i) => i.key === f.key);
      if (!item) continue;
      // Checkbox tanpa opsi yang tidak dicentang (value === false, tanpa
      // catatan) tidak perlu baris sama sekali — konsisten dengan "tidak
      // ada baris = tidak dicentang" yang dipakai form-skor.ts & hidrasi
      // formValuesMap di frontend.
      if (!item.options.length && f.value === false && !f.note) continue;
      const option = item.options.find((o) => o.value === String(f.value));
      formValueCreates.push({
        itemId: item.id,
        optionId: option?.id,
        valueText: option
          ? f.note
          : typeof f.value === 'string'
            ? f.value
            : f.note,
        valueNumber: typeof f.value === 'number' ? f.value : undefined,
      });
    }

    return { skorEvaluasi, formValueCreates };
  }

  /** Rasio dana/output/outcome paket ini — dipakai item Valuasi yang
   * membandingkan rasio ke ambang batas admin (FormItem.thresholdValue,
   * kolom "Standar (S)" di sheet). `paketSekarang` diterima langsung dari
   * pemanggil (bukan di-query lewat roId) — paket yang baru dibuat/preview
   * belum tentu ada di DB. */
  private hitungRasioValuasi(paketSekarang?: PaketRingkas): ValuasiRatios {
    if (!paketSekarang) return {};
    const { totalDana, outputTarget, outcomeTarget } = paketSekarang;
    return {
      danaPerOutput: outputTarget > 0 ? totalDana / outputTarget : null,
      danaPerOutcome: outcomeTarget > 0 ? totalDana / outcomeTarget : null,
      outputPerOutcome:
        outcomeTarget > 0 ? outputTarget / outcomeTarget : null,
    };
  }

  /** Preview skor evaluasi tanpa menyimpan apa pun — dipakai form Proyek
   * (create maupun edit) supaya tab Evaluasi ter-update live. */
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

    const { skorEvaluasi } = await this.hitungEvaluasi(
      this.prisma,
      dto,
      dto.roId,
      paketSekarang,
      dto.formValues,
      dto.proyekId,
    );

    return { skorEvaluasi };
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
      const { skorEvaluasi, formValueCreates } = await this.hitungEvaluasi(
        tx,
        dto,
        paket0?.roId,
        paketSekarang,
        dto.formValues,
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
          formValues: formValueCreates.length
            ? { create: formValueCreates }
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

    // Skor evaluasi dihitung ulang tiap kali proyek disimpan dari struktur
    // Form Proyek (Master Data) — lihat hitungEvaluasi/form-skor.ts.
    // Bukan $transaction — cuma pembacaan sebelum satu nested-write .update().
    const { skorEvaluasi, formValueCreates } = await this.hitungEvaluasi(
      this.prisma,
      { ...proyek, ...dto },
      paket0?.roId,
      paketSekarang,
      dto.formValues,
      id,
    );

    const updated = await this.prisma.proyek.update({
      where: { id },
      data: {
        // kodeProyek sengaja tidak diikutkan — permanen sejak dibuat.
        skorEvaluasi,
        formValues: {
          deleteMany: {},
          create: formValueCreates,
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
    formItemId?: string,
  ) {
    const proyek = await this.prisma.proyek.findUnique({
      where: { id: proyekId },
    });
    if (!proyek) throw new NotFoundException('Proyek tidak ditemukan');
    if (!files?.length) {
      throw new BadRequestException('Tidak ada file yang diupload');
    }

    // create() satu-satu (bukan createMany) supaya baris yang baru dibuat
    // (dengan id-nya) bisa langsung dikembalikan ke frontend.
    const created = await Promise.all(
      files.map((f) =>
        this.prisma.dokumenPendukung.create({
          data: {
            proyekId,
            formItemId,
            fileName: f.originalname,
            // Path relatif terhadap folder uploads/ — disajikan statis di
            // /uploads/... (lihat app.useStaticAssets di main.ts).
            filePath: `proyek/${proyekId}/${f.filename}`,
            mimeType: f.mimetype,
            size: f.size,
            uploadedById: userId,
          },
        }),
      ),
    );

    // File yang di-tag ke field UPLOAD di form dinamis mengubah skor
    // evaluasi (lihat hitungEvaluasi) — hitung ulang & simpan.
    if (formItemId) {
      await this.recalcSkorEvaluasi(proyekId);
    }

    await this.invalidateCache(proyekId);
    return created;
  }

  /** Hitung ulang skorEvaluasi proyek dari data yang SUDAH tersimpan (paket +
   * ProyekFormValue + DokumenPendukung) — dipakai setelah upload file ke
   * field UPLOAD, karena skor awal saat create/update belum tahu file itu
   * (di-upload belakangan, lihat pola staging di proyek-form-dialog.tsx). */
  private async recalcSkorEvaluasi(proyekId: string) {
    const proyek = await this.prisma.proyek.findUnique({
      where: { id: proyekId },
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
        formValues: { include: { item: true, option: true } },
      },
    });
    if (!proyek) return;

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

    const formValues: FormValueDto[] = proyek.formValues.map((fv) => ({
      key: fv.item.key,
      value:
        fv.option?.value ??
        fv.valueText ??
        fv.valueNumber ??
        fv.valueDate?.toISOString(),
    }));

    const { skorEvaluasi } = await this.hitungEvaluasi(
      this.prisma,
      proyek,
      paket0?.roId,
      paketSekarang,
      formValues,
      proyekId,
    );

    await this.prisma.proyek.update({
      where: { id: proyekId },
      data: { skorEvaluasi },
    });
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
