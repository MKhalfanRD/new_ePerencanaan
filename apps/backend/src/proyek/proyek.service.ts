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
import {
  paketFormValueRows,
  storedValue,
  toFormValueRows,
} from '../common/form-value-rows';
import { UpdateProyekDto } from './dto/update-proyek.dto';
import { QueryProyekDto } from './dto/query-proyek.dto';
import { generateKodeProyek } from '../common/kode-generator';
import {
  hitungSkorEvaluasi,
  ScoringTabDef,
  ItemValueLookup,
  kondisiTerpenuhi,
  rincianSkor,
  RincianTab,
  RingkasPaket,
  RasioConfig,
  ringkasPaket,
  paketRingkasDb,
  hitungRasio,
} from './form-skor';
import { LINTAS_KEGIATAN, roleEfektif } from '../auth/role';
import {
  cekIsianPaket,
  cekSaldo,
  kolomPaket,
  relasiPaketBaru,
  ringkasIsian,
  satkerPaket,
} from '../paket/paket-data';
import { PreviewSkorDto, FormValueDto } from './dto/preview-skor.dto';


// Data paket utk rasio Valuasi & saldo (lihat paketRingkasDb).
const paketRingkasInclude = {
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

/** Akun Balai/Satker: proyek selalu di balainya sendiri. */
const balaiAkun = (user: any, balaiId?: number) =>
  user?.balaiId && !LINTAS_KEGIATAN.includes(user.role) ? user.balaiId : balaiId;
/** Saklar izin satker cuma boleh diubah akun pusat/Balai. */
const izinSatker = (user: any, nilai?: boolean) =>
  user?.satkerId && !LINTAS_KEGIATAN.includes(user.role) ? undefined : nilai;

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
      satker: { select: { id: true, name: true } },
      indikatorRo: {
        include: {
          indikatorRo: { include: { satuanList: { include: { satuan: true } } } },
        },
        orderBy: { order: Prisma.SortOrder.asc },
      },
      formValues: { include: { item: true, option: true } },
      alokasi: {
        include: { lokasi: true, komponen: true },
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
  // sasaran* ikut di-include: form edit butuh id-nya utk isi dropdown SP/SK.
  indikatorSasaranProgram: { include: { sasaranProgram: true } },
  indikatorSasaranKegiatan: { include: { sasaranKegiatan: true } },
  tematikRenja: true,
  dokumenPendukung: true,
  formValues: { include: { item: true, option: true } },
});

/** Kolom lokasi Proyek dari DTO — sama seperti LokasiAlokasi: TITIK cuma
 * simpan lat/long, GARIS/POLIGON cuma coordinates (sisi lain dikosongkan
 * supaya ganti tipe tidak meninggalkan data basi). */
function lokasiData(dto: Partial<CreateProyekDto>) {
  const titik = dto.tipeKoordinat === 'TITIK';
  const adaTipe = dto.tipeKoordinat !== undefined;
  return {
    tipeKoordinat: dto.tipeKoordinat as any,
    provinceId: dto.provinceId,
    provinceName: dto.provinceName,
    cityId: dto.cityId,
    cityName: dto.cityName,
    districtId: dto.districtId,
    districtName: dto.districtName,
    villageId: dto.villageId,
    villageName: dto.villageName,
    latitude: adaTipe && !titik ? null : dto.latitude,
    longitude: adaTipe && !titik ? null : dto.longitude,
    coordinates: adaTipe && titik ? Prisma.DbNull : (dto.coordinates ?? undefined),
  };
}

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
    // Total semua paket (alokasi RENCANA) utk field RASIO — lihat
    // ringkasPaket() di form-skor.ts.
    paketSekarang?: RingkasPaket,
    formValues?: FormValueDto[],
    // Proyek yang SUDAH ada (edit, atau recalc setelah upload) — dipakai
    // buat cek field UPLOAD ("terisi" = ada DokumenPendukung, bukan dari
    // formValues yang memang tidak pernah membawa file). undefined saat
    // proyek baru pertama kali dibuat (belum punya id, belum ada file).
    proyekIdUntukUpload?: string,
  ): Promise<{
    skorEvaluasi: number | null;
    formValueCreates: Prisma.ProyekFormValueCreateManyProyekInput[];
    rincian?: RincianTab[];
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

    const genericValues = new Map(
      (formValues ?? []).map((f) => [f.key, f.value]),
    );

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

    // Nilai field RASIO (per key) dihitung dari total paket & rumus admin.
    const nilaiRasio = new Map<string, number | null>();
    const ringkas = paketSekarang;
    for (const i of allItems)
      if (i.fieldType === 'RASIO' && ringkas)
        nilaiRasio.set(i.key, hitungRasio(i.rasio as RasioConfig | null, ringkas));

    const lookup: ItemValueLookup = (key) => {
      // Kolom tetap Proyek (field bawaan) — termasuk field teks seperti
      // sumberUsulanLainnya yang bisa diberi skor "jika terisi".
      if (FIXED_ITEM_KEYS.has(key) || (input && key in input))
        return input[key];
      if (nilaiRasio.has(key)) return nilaiRasio.get(key);
      if (uploadedKeys.has(key)) return true;
      return genericValues.get(key);
    };
    // Bagian bersyarat (mis. "Khusus kategori …") tampil & dihitung hanya
    // kalau field pemicunya bernilai salah satu dari conditionValue.
    const bagianTampil = (s: { conditionItemId: string | null; conditionValue: string | null }) =>
      !s.conditionItemId || kondisiTerpenuhi(s.conditionValue, lookup(s.conditionItemId));
    const tabs: ScoringTabDef[] = formTabs
      .sort((a, b) => a.order - b.order)
      .map((t) => ({
      key: t.key,
      label: t.label,
      bobot: t.bobot,
      items: t.sections
        .filter(bagianTampil)
        .flatMap((s) => s.items)
        .filter(
          (i) =>
            !i.conditionItemId ||
            kondisiTerpenuhi(i.conditionValue, lookup(i.conditionItemId)),
        )
        .map((i) => ({
          key: i.key,
          score: i.score,
          isActive: true,
          fieldType: i.fieldType,
          conditionItemId: i.conditionItemId,
          conditionValue: i.conditionValue,
          thresholdValue: i.thresholdValue,
          operator: (i.rasio as RasioConfig | null)?.operator,
          options: i.options.map((o) => ({
            value: o.value,
            score: o.score,
            isActive: true,
          })),
        })),
    }));

    const skorEvaluasi = hitungSkorEvaluasi(tabs, lookup);
    const rincian = rincianSkor(tabs, lookup);

    // Simpan cuma item yang BUKAN backed kolom fixed/rasio — itu sudah
    // tersimpan di kolomnya sendiri (mis. Kategori Proyek, item Kinerja).
    const formValueCreates: Prisma.ProyekFormValueCreateManyProyekInput[] =
      toFormValueRows(
        allItems,
        formValues?.filter(
          (f) => !FIXED_ITEM_KEYS.has(f.key) && !nilaiRasio.has(f.key),
        ),
      );

    return { skorEvaluasi, formValueCreates, rincian };
  }

  /** Preview skor evaluasi tanpa menyimpan apa pun — dipakai form Proyek
   * (create maupun edit) supaya tab Evaluasi ter-update live. */
  async previewEvaluasi(dto: PreviewSkorDto) {
    // Total semua paket dari form (sudah dijumlah frontend).
    const paketSekarang: RingkasPaket = {
      A: dto.totalDana ?? 0,
      B: dto.outputTarget ?? 0,
      C: dto.outcomeTarget ?? 0,
      satuanB: dto.outputUnits ?? [],
      satuanC: dto.outcomeUnits ?? [],
    };

    const { skorEvaluasi, rincian } = await this.hitungEvaluasi(
      this.prisma,
      dto,
      dto.roId,
      paketSekarang,
      dto.formValues,
      dto.proyekId,
    );

    return { skorEvaluasi, rincian: rincian ?? [] };
  }

  async create(dto: CreateProyekDto, user: any) {
    const userId: string = user?.userId;
    const userRole: string | undefined = user?.role;
    dto.balaiId = balaiAkun(user, dto.balaiId);
    for (const p of dto.paket ?? []) cekIsianPaket(p);
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
      for (const p of dto.paket ?? [])
        p.satkerId = await satkerPaket(tx, user, dto.balaiId, p.satkerId);
      // Anggaran semua paket, volume paket UTAMA — rasio Valuasi & saldo.
      const ringkasan = (await Promise.all((dto.paket ?? []).map((p) => ringkasIsian(tx, p)))).flat();
      cekSaldo(dto, ringkasan);
      const paketSekarang = ringkasPaket(ringkasan);
      const { skorEvaluasi, formValueCreates } = await this.hitungEvaluasi(
        tx,
        dto,
        paket0?.roId,
        paketSekarang,
        dto.formValues,
      );

      const paketValues = await Promise.all(
        (dto.paket ?? []).map((p) =>
          paketFormValueRows(tx, p.roId, p.formValues),
        ),
      );

      return tx.proyek.create({
        data: {
          balaiId: dto.balaiId,
          periodeId: dto.periodeId,
          kodeProyek,
          projectName: dto.projectName,
          kewenangan: (dto.kewenangan ?? 'PUSAT') as any,
          ...lokasiData(dto),
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
          saldoAnggaran: dto.saldoAnggaran,
          saldoVolumeRo: dto.saldoVolumeRo,
          saldoVolumeIro: dto.saldoVolumeIro,
          satkerBolehUbahPaket: izinSatker(user, dto.satkerBolehUbahPaket),

          paket: dto.paket
            ? {
                create: dto.paket.map((p, idx) => ({
                  kodePaket: `PA${proyekPart}${String(idx + 1).padStart(4, '0')}`,
                  ...kolomPaket(p),
                  ...relasiPaketBaru(p),
                  formValues: paketValues[idx].length
                    ? { create: paketValues[idx] }
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

  /** Proyek yang dibuat/ditambah oleh sesi import terakhir user ini (dari log aktivitas). */
  private async proyekImportTerakhir(user: any): Promise<string[]> {
    const dariImport = {
      userId: user.userId,
      path: '/import/commit',
      meta: { path: ['source'], equals: 'import' },
    };
    const terakhir = await this.prisma.activityLog.findFirst({
      where: dariImport,
      orderBy: { createdAt: 'desc' },
      select: { meta: true },
    });
    const sesi = (terakhir?.meta as any)?.sessionId;
    if (!sesi) return [];
    const log = await this.prisma.activityLog.findMany({
      where: { ...dariImport, AND: [{ meta: { path: ['sessionId'], equals: sesi } }] },
      select: { entityId: true },
    });
    return log.map((l) => l.entityId).filter((id): id is string => !!id);
  }

  async findAll(user: any, query: QueryProyekDto) {
    const { status, page = 1, limit = 10, search, periodeId, importTerakhir } =
      query;
    const skip = (page - 1) * limit;

    const cacheKey = `proyek:list:${user.userId}:${user.role}:${user.kegiatanId ?? ''}:${status ?? ''}:${page}:${limit}:${search ?? ''}:${periodeId ?? ''}:${importTerakhir ?? ''}`;
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
    if (importTerakhir === '1') where.id = { in: await this.proyekImportTerakhir(user) };

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
          where: { deletedAt: null },
          orderBy: { createdAt: Prisma.SortOrder.asc },
          include: paketRingkasInclude,
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
    // Total SEMUA paket & tahun (alokasi RENCANA) — rasio Valuasi.
    const paketSekarang = ringkasPaket(proyek.paket.flatMap(paketRingkasDb));
    cekSaldo({ ...proyek, ...dto }, proyek.paket.flatMap(paketRingkasDb));

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
        balaiId: balaiAkun(user, dto.balaiId),
        periodeId: dto.periodeId,
        projectName: dto.projectName,
        kewenangan: dto.kewenangan as any,
        ...lokasiData(dto),
        // Akun Satker cuma boleh ubah saldo kalau saklar izin menyala.
        ...(izinSatker(user, true) === undefined && !proyek.satkerBolehUbahPaket
          ? {}
          : {
              saldoAnggaran: dto.saldoAnggaran,
              saldoVolumeRo: dto.saldoVolumeRo,
              saldoVolumeIro: dto.saldoVolumeIro,
            }),
        satkerBolehUbahPaket: izinSatker(user, dto.satkerBolehUbahPaket),
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
          where: { deletedAt: null },
          orderBy: { createdAt: Prisma.SortOrder.asc },
          include: paketRingkasInclude,
        },
        formValues: { include: { item: true, option: true } },
      },
    });
    if (!proyek) return;

    const paket0 = proyek.paket?.[0];
    // Total SEMUA paket & tahun (alokasi RENCANA) — rasio Valuasi.
    const paketSekarang = ringkasPaket(proyek.paket.flatMap(paketRingkasDb));

    const formValues: FormValueDto[] = proyek.formValues.map((fv) => ({
      key: fv.item.key,
      value: storedValue(fv) as FormValueDto['value'],
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
