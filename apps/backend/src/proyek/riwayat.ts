import { Prisma } from '@prisma/client';
import { storedValue } from '../common/form-value-rows';
import { LABEL_STATUS } from './alur-status';

/**
 * Riwayat proyek (docs-planning/flowchart-riwayat-proyek.pdf): potret seluruh
 * isi proyek jadi baris berlabel, lalu bandingkan sebelum/sesudah tiap simpan.
 * Label kolom diambil dari form kegiatan proyek (Master Data › Form Proyek).
 */
type Db = Prisma.TransactionClient;
export interface BarisPotret {
  bagian: string;
  kolom: string;
  nilai: string;
}
export type Potret = Map<string, BarisPotret>;
export interface Perubahan {
  key: string;
  bagian: string;
  kolom: string;
  sebelum: string | null;
  sesudah: string | null;
}

const SUMBER = ['rm', 'rmp', 'pln', 'sbsn', 'kpbu'] as const;
const STATUS_KRITERIA: Record<string, string> = { RENCANA: 'Rencana', SUDAH_ADA: 'Ada', TIDAK_PERLU: 'Tidak perlu' };
const rp = (v: unknown) => `Rp ${Number(v ?? 0).toLocaleString('id-ID')}`;
const angka = (v: unknown) => Number(v).toLocaleString('id-ID', { maximumFractionDigits: 4 });
const yaTidak = (v: unknown) => (v ? 'Ya' : 'Tidak');
const tahunList = (v: unknown) => (Array.isArray(v) && v.length ? [...v].sort().join(', ') : null);

/** Kolom bawaan proyek: [key form, label cadangan, tab cadangan, nilai]. */
type Bawaan = [string, string, string, (p: any) => unknown];
const kriteria = (status: string, tahun: string) => (p: any) =>
  p[status] ? `${STATUS_KRITERIA[p[status]] ?? p[status]}${p[tahun] ? ` · ${p[tahun]}` : ''}` : null;
const BAWAAN: Bawaan[] = [
  ['periodeId', 'Periode', 'Identitas Proyek', (p) => p.periode?.label],
  ['projectName', 'Nama proyek', 'Identitas Proyek', (p) => p.projectName],
  ['balaiId', 'Unit kerja / balai', 'Identitas Proyek', (p) => p.balai?.name],
  ['wilayahSungaiId', 'Wilayah sungai', 'Identitas Proyek', (p) => p.wilayahSungai?.name],
  ['sumberUsulanProyek', 'Sumber usulan proyek', 'Dasar Pelaksanaan', (p) => p.sumberUsulanProyek],
  ['sumberUsulanLainnya', 'Sumber usulan lainnya', 'Dasar Pelaksanaan', (p) => p.sumberUsulanLainnya],
  ['justifikasiProyek', 'Justifikasi proyek', 'Dasar Pelaksanaan', (p) => p.justifikasiProyek],
  [
    'provinceId',
    'Wilayah administratif',
    'Lokasi Proyek',
    (p) => [p.provinceName, p.cityName, p.districtName, p.villageName].filter(Boolean).join(' › '),
  ],
  [
    'latitude',
    'Koordinat',
    'Lokasi Proyek',
    (p) =>
      p.tipeKoordinat === 'TITIK'
        ? p.latitude != null
          ? `${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}`
          : null
        : Array.isArray(p.coordinates) && p.coordinates.length
          ? `${p.tipeKoordinat === 'GARIS' ? 'Garis' : 'Poligon'} · ${p.coordinates.length} titik`
          : null,
  ],
  ['statusDed', 'DED', 'Kesiapan Teknis', kriteria('statusDed', 'tahunDed')],
  ['statusDokumenLingkungan', 'Dokumen lingkungan', 'Kesiapan Teknis', kriteria('statusDokumenLingkungan', 'tahunDokumenLingkungan')],
  ['statusLarap', 'LARAP', 'Kesiapan Teknis', kriteria('statusLarap', 'tahunLarap')],
  ['statusStudiLayak', 'Studi kelayakan', 'Kesiapan Teknis', kriteria('statusStudiLayak', 'tahunStudiLayak')],
  ['kewenangan', 'Kewenangan', 'Kesiapan Teknis', (p) => ({ PUSAT: 'Pusat', DAERAH: 'Daerah' })[p.kewenangan as string] ?? p.kewenangan],
  ['kebutuhanTanah', 'Kebutuhan tanah', 'Kesiapan Teknis', (p) => (p.kebutuhanTanah ? 'Ada' : 'Tidak ada')],
  [
    'kegiatanPrioritasId',
    'PN / PP / KP',
    'Tagging',
    (p) => {
      const kp = p.kegiatanPrioritas;
      return kp
        ? [kp.programPrioritas?.prioritasNasional?.name, kp.programPrioritas?.name, kp.name].filter(Boolean).join(' › ')
        : null;
    },
  ],
  ['indikatorSasaranProgramId', 'Indikator sasaran program', 'Tagging', (p) => p.indikatorSasaranProgram?.name],
  ['indikatorSasaranKegiatanId', 'Indikator sasaran kegiatan', 'Tagging', (p) => p.indikatorSasaranKegiatan?.name],
  ['tematikRenjaId', 'Tematik RENJA', 'Tagging', (p) => p.tematikRenja?.name],
  ['pkpnId', 'PKPN', 'Tagging', (p) => p.pkpn?.name],
  ['fkb', 'FKB', 'Tagging', (p) => tahunList(p.fkb)],
  ['fkw', 'FKW', 'Tagging', (p) => tahunList(p.fkw)],
  ['mpa', 'MPA', 'Tagging', (p) => tahunList(p.mpa)],
  ['taggingDinamis', 'Tagging dinamis', 'Tagging', (p) => (p.taggingDinamis ?? []).join(', ')],
  ['satkerBolehUbahPaket', 'Satker boleh membuat & mengubah paket', 'Pemaketan', (p) => yaTidak(p.satkerBolehUbahPaket)],
  ['saldoVolumeRo', 'Saldo volume RO', 'Pemaketan', (p) => (p.saldoVolumeRo == null ? null : angka(p.saldoVolumeRo))],
  ['saldoVolumeIro', 'Saldo volume IRO', 'Pemaketan', (p) => (p.saldoVolumeIro == null ? null : angka(p.saldoVolumeIro))],
  ['catatanPembina', 'Catatan pembina', 'Dokumen dan Catatan', (p) => p.catatanPembina],
  ['catatanSspsda', 'Catatan SSPSDA', 'Dokumen dan Catatan', (p) => p.catatanSspsda],
];

const teks = (v: unknown): string => {
  if (v == null || v === '') return '';
  if (v instanceof Date) return v.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  return String(v);
};

/** Potret seluruh isi proyek. Proyek tidak ada = potret kosong. */
export async function potretProyek(db: Db, proyekId: string): Promise<Potret> {
  const hasil: Potret = new Map();
  const p: any = await db.proyek.findUnique({
    where: { id: proyekId },
    include: {
      balai: true,
      periode: true,
      wilayahSungai: true,
      kegiatanPrioritas: { include: { programPrioritas: { include: { prioritasNasional: true } } } },
      pkpn: true,
      indikatorSasaranProgram: true,
      indikatorSasaranKegiatan: true,
      tematikRenja: true,
      dokumenPendukung: true,
      formValues: { include: { item: true, option: true } },
      paket: {
        where: { deletedAt: null },
        include: {
          ro: { include: { kro: true, satuan: true } },
          satker: true,
          indikatorRo: { include: { indikatorRo: true } },
          formValues: { include: { item: true, option: true } },
          alokasi: { include: { komponen: true } },
        },
      },
    },
  });
  if (!p) return hasil;

  // Label & tab tiap kolom dari form kegiatan proyek.
  const tab = new Map<string, { label: string; tab: string; options: Map<string, string> }>();
  if (p.kegiatanId) {
    const template = await db.formTemplate.findUnique({
      where: { kegiatanId: p.kegiatanId },
      include: { tabs: { include: { sections: { include: { items: { include: { options: true } } } } } } },
    });
    for (const t of template?.tabs ?? [])
      for (const s of t.sections)
        for (const i of s.items)
          tab.set(i.key, { label: i.label, tab: t.label, options: new Map(i.options.map((o) => [o.value, o.label])) });
  }
  const isi = (key: string, bagian: string, kolom: string, nilai: unknown) => {
    const t = teks(nilai);
    if (t) hasil.set(key, { bagian, kolom, nilai: t });
  };

  for (const [key, label, tabCadangan, nilai] of BAWAAN) {
    const t = tab.get(key);
    isi(`f:${key}`, t?.tab ?? tabCadangan, t?.label ?? label, nilai(p));
  }
  hasil.set('status', { bagian: 'Status', kolom: 'Status proyek', nilai: LABEL_STATUS[p.status as keyof typeof LABEL_STATUS] });

  // Isian kolom tambahan admin (proyek & paket).
  const nilaiIsian = (fv: any) => {
    const v = storedValue(fv);
    const opsi = tab.get(fv.item.key)?.options;
    if (Array.isArray(v)) return v.map((x) => opsi?.get(String(x)) ?? String(x)).join(', ');
    if (typeof v === 'boolean') return yaTidak(v);
    if (fv.option?.label) return fv.option.label;
    if (typeof v === 'string' && opsi?.has(v)) return opsi.get(v);
    if (typeof v === 'number') return angka(v);
    return v;
  };
  for (const fv of p.formValues) {
    const t = tab.get(fv.item.key);
    isi(`fv:${fv.item.key}`, t?.tab ?? 'Kolom tambahan', t?.label ?? fv.item.label, nilaiIsian(fv));
  }

  // Dokumen (per berkas; kolom = label kolom upload).
  const labelItemId = new Map<string, string>();
  for (const fv of p.formValues) labelItemId.set(fv.itemId, fv.item.label);
  const itemUpload = p.kegiatanId
    ? await db.formItem.findMany({
        where: { id: { in: p.dokumenPendukung.map((d: any) => d.formItemId).filter(Boolean) } },
        select: { id: true, label: true },
      })
    : [];
  for (const i of itemUpload) labelItemId.set(i.id, i.label);
  for (const d of p.dokumenPendukung)
    isi(`dok:${d.id}`, 'Dokumen', (d.formItemId && labelItemId.get(d.formItemId)) || 'Dokumen pendukung', d.fileName);

  // Paket, alokasi per tahun, realisasi.
  for (const k of p.paket) {
    const n = k.name || 'Paket';
    const pk = (sub: string) => `pk:${k.id}:${sub}`;
    isi(pk('nama'), 'Paket', `${n} › Nama paket`, k.name);
    isi(pk('satker'), 'Paket', `${n} › Satker`, k.satker?.name);
    isi(pk('ro'), 'Paket', `${n} › KRO / RO`, k.ro ? `${k.ro.kro?.code}.${k.ro.code} ${k.ro.name}` : null);
    isi(pk('iro'), 'Paket', `${n} › Indikator RO`, k.indikatorRo?.[0]?.indikatorRo?.nama);
    isi(
      pk('tahun'),
      'Paket',
      `${n} › Tahun pelaksanaan`,
      k.tahunMulai ? (k.tahunMulai === k.tahunSelesai ? k.tahunMulai : `${k.tahunMulai}–${k.tahunSelesai}`) : null,
    );
    isi(
      pk('lokasi'),
      'Paket',
      `${n} › Lokasi paket`,
      k.lokasiSamaProyek
        ? 'Sama dengan lokasi proyek'
        : [k.villageName, k.districtName, k.cityName, k.provinceName].filter(Boolean).join(', ') || 'Lokasi sendiri',
    );
    for (const fv of k.formValues) isi(pk(`fv:${fv.item.key}`), 'Paket', `${n} › ${fv.item.label}`, nilaiIsian(fv));
    for (const a of k.alokasi) {
      const real = a.status === 'REALISASI';
      const bagian = real ? 'Realisasi' : 'Alokasi';
      const awal = `${n} › ${a.tahun}${real ? ' › Realisasi' : ''}`;
      const kunci = `${k.id}:${a.tahun}:${a.status}`;
      if (!real) {
        isi(`al:${kunci}:komp`, bagian, `${awal} › Komponen`, a.komponen ? `${a.komponen.code} ${a.komponen.name}` : null);
        isi(`al:${kunci}:ro`, bagian, `${awal} › Volume RO`, a.outputTarget == null ? null : `${angka(a.outputTarget)} ${k.ro?.satuan?.name ?? ''}`.trim());
        isi(`al:${kunci}:iro`, bagian, `${awal} › Volume IRO`, a.outcomeTarget == null ? null : angka(a.outcomeTarget));
      }
      for (const s of SUMBER)
        if (Number(a[s]) > 0) isi(`al:${kunci}:${s}`, bagian, `${awal} › ${s.toUpperCase()}`, rp(a[s]));
    }
  }
  return hasil;
}

/** Baris yang berbeda antara dua potret. */
export function bandingkan(sebelum: Potret, sesudah: Potret): Perubahan[] {
  const keys = new Set([...sebelum.keys(), ...sesudah.keys()]);
  const out: Perubahan[] = [];
  for (const key of keys) {
    const a = sebelum.get(key);
    const b = sesudah.get(key);
    if (a?.nilai === b?.nilai) continue;
    const ref = b ?? a!;
    out.push({ key, bagian: ref.bagian, kolom: ref.kolom, sebelum: a?.nilai ?? null, sesudah: b?.nilai ?? null });
  }
  return out;
}

/**
 * Catat 1 entri riwayat: bandingkan potret `sebelum` dengan isi sekarang.
 * Tanpa perubahan & tanpa `selaluCatat` = tidak dicatat. Gagal mencatat tidak
 * boleh menggagalkan simpanan aslinya.
 */
export async function catatRiwayat(
  db: Db,
  opsi: { proyekId: string; userId?: string; aksi: string; sebelum?: Potret; catatan?: string | null; selaluCatat?: boolean },
) {
  try {
    const perubahan = opsi.sebelum ? bandingkan(opsi.sebelum, await potretProyek(db, opsi.proyekId)) : [];
    if (!perubahan.length && !opsi.selaluCatat) return;
    await db.riwayatProyek.create({
      data: {
        proyekId: opsi.proyekId,
        userId: opsi.userId ?? null,
        aksi: opsi.aksi,
        catatan: opsi.catatan?.trim() || null,
        perubahan: perubahan as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    console.error('Gagal mencatat riwayat proyek', opsi.proyekId, e);
  }
}
