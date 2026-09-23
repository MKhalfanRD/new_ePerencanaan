/**
 * Seed Form Proyek (Master Data) — isi awal template per Kegiatan, dari
 * referensi 1.xlsx sheet "Form Proyek 7691". Dijalankan sekali setelah
 * migrasi model FormTemplate/FormTab/FormSection/FormItem/FormItemOption
 * (menggantikan MetodeEvaluasi/EvaluasiItem/ProyekEvaluasi).
 *
 * - Kegiatan "7691" (Irigasi & Rawa) dapat isi PENUH sesuai sheet — jadi
 *   referensi lengkap 10 tab.
 * - Kegiatan lain yang sudah punya data lama (EvaluasiItem, sebelum tabel
 *   itu dihapus) dimigrasikan best-effort ke tab Dasar/Kesiapan/Tematik
 *   (checkbox datar, skor dipertahankan); tab Valuasi/Kinerja & tab
 *   struktural disalin dari kerangka 7691 (isi/skor bisa disesuaikan lagi
 *   lewat kanvas Master Data — lihat form-proyek-tab.tsx).
 * - Kegiatan lainnya: dibuat kosong (10 tab tanpa isi), admin pakai fitur
 *   "clone dari kegiatan lain" di kanvas.
 *
 * Jalankan: npx ts-node prisma/scripts/seed-form-template.ts
 * (opsional --dry untuk lihat rencana tanpa menulis ke DB)
 */
import { PrismaClient, FormFieldType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

// Dump EvaluasiItem/MetodeEvaluasi sebelum tabelnya dihapus (lihat
// migrasi form_proyek_template) — dipakai migrasi best-effort di bawah.
const OLD_DUMP_PATH = process.env.OLD_EVALUASI_DUMP_PATH;
interface OldItem {
  kegiatanId: string;
  metodeId: string;
  name: string;
  score: number;
}
interface OldDump {
  metode: { id: string; name: string }[];
  item: OldItem[];
}
const oldDump: OldDump | null =
  OLD_DUMP_PATH && fs.existsSync(OLD_DUMP_PATH)
    ? JSON.parse(fs.readFileSync(OLD_DUMP_PATH, 'utf-8'))
    : null;

type ItemDef = {
  key: string;
  label: string;
  fieldType: FormFieldType;
  score?: number | null;
  thresholdValue?: number | null;
  conditionItemId?: string | null;
  conditionValue?: string | null;
  options?: { value: string; label: string; score?: number | null }[];
};
type SectionDef = { key: string; label: string; items: ItemDef[] };
type TabDef = {
  key: string;
  label: string;
  bobot: number | null;
  sections: SectionDef[];
};

// ============================================================
// Tab struktural — field-nya kolom Proyek tetap, FormItem di sini cuma
// dipakai admin buat toggle aktif/nonaktif + ubah label tampilan.
// ============================================================
function tabStrukturalIdentitas(): TabDef {
  return {
    key: 'identitas',
    label: 'Identitas Proyek',
    bobot: null,
    sections: [
      {
        key: 'identitas',
        label: 'Identitas Proyek',
        items: [
          { key: 'balaiId', label: 'Balai', fieldType: 'DROPDOWN' },
          { key: 'periodeId', label: 'Periode', fieldType: 'DROPDOWN' },
          { key: 'projectName', label: 'Nama Proyek', fieldType: 'TEXT' },
          {
            key: 'wilayahSungaiId',
            label: 'Wilayah Sungai',
            fieldType: 'DROPDOWN',
          },
        ],
      },
    ],
  };
}
function tabStrukturalLokasi(): TabDef {
  return {
    key: 'lokasi',
    label: 'Lokasi Proyek',
    bobot: null,
    sections: [
      {
        key: 'lokasi',
        label: 'Lokasi Proyek',
        items: [
          { key: 'provinceId', label: 'Provinsi', fieldType: 'DROPDOWN' },
          { key: 'cityId', label: 'Kabupaten/Kota', fieldType: 'DROPDOWN' },
          { key: 'latitude', label: 'Titik Lokasi (peta)', fieldType: 'TEXT' },
        ],
      },
    ],
  };
}
function tabStrukturalPemaketan(): TabDef {
  // Tidak ada item — bagian pemaketan (tambah/kelola paket) selalu tampil
  // utuh saat tab ini aktif, belum ada sub-field yang bisa diatur granular
  // (lihat proyek-form-dialog.tsx, TAB pemaketan tidak dibungkus per-field).
  return { key: 'pemaketan', label: 'Pemaketan', bobot: null, sections: [] };
}
function tabStrukturalDokumen(): TabDef {
  return {
    key: 'dokumen',
    label: 'Dokumen dan Catatan',
    bobot: null,
    sections: [
      {
        key: 'dokumen',
        label: 'Dokumen dan Catatan',
        items: [
          { key: 'dokumenPendukung', label: 'Dokumen Pendukung', fieldType: 'UPLOAD' },
          {
            key: 'catatanPembina',
            label: 'Catatan Pembina',
            fieldType: 'FIELDBOX',
          },
          {
            key: 'catatanSspsda',
            label: 'Catatan SSPSDA',
            fieldType: 'FIELDBOX',
          },
        ],
      },
    ],
  };
}
function tabEvaluasiMarker(): TabDef {
  // Tab 10 "Evaluasi Proyek" — read-only, cuma penanda urutan tab. Isinya
  // (breakdown skor) dihitung live dari 5 tab skoring, bukan section/item
  // tersendiri.
  return { key: 'evaluasi', label: 'Evaluasi Proyek', bobot: null, sections: [] };
}

// ============================================================
// Tab skoring — isi PENUH sesuai sheet, dipakai kegiatan 7691.
// ============================================================
function tabDasarPelaksanaan7691(): TabDef {
  // Proyek.sumberUsulanProyek cuma simpan 5 label master (bukan 8 baris
  // sheet C13-C20) — skor dipetakan best-effort ke 5 label itu.
  return {
    key: 'dasar',
    label: 'Dasar Pelaksanaan',
    bobot: 0.3,
    sections: [
      {
        key: 'sumber-usulan',
        label: 'Sumber Usulan Proyek',
        items: [
          {
            key: 'sumberUsulanProyek',
            label: 'Sumber Usulan Proyek',
            fieldType: 'DROPDOWN',
            options: [
              { value: 'Pemerintah Daerah', label: 'Pemerintah Daerah', score: 2 },
              { value: 'Kementerian/Lembaga', label: 'Kementerian/Lembaga', score: 2 },
              { value: 'Tindak Lanjut Renaksi', label: 'Tindak Lanjut Renaksi', score: 1 },
              { value: 'Masyarakat', label: 'Masyarakat', score: 1 },
              { value: 'Lainnya', label: 'Lainnya', score: 0 },
            ],
          },
          {
            key: 'sumberUsulanLainnya',
            label: 'Sumber Usulan Lainnya',
            fieldType: 'FIELDBOX',
          },
          {
            key: 'justifikasiProyek',
            label: 'Justifikasi Proyek',
            fieldType: 'FIELDBOX',
          },
        ],
      },
    ],
  };
}
function tabKesiapanTeknis7691(): TabDef {
  return {
    key: 'kesiapan',
    label: 'Kesiapan Teknis',
    bobot: 0.25,
    sections: [
      {
        key: 'kelengkapan',
        label: 'Kelengkapan Proyek',
        items: [
          {
            key: 'statusDed',
            label: 'DED',
            fieldType: 'DROPDOWN',
            options: [
              { value: 'SUDAH_ADA', label: 'Ada', score: 2 },
              { value: 'RENCANA', label: 'Rencana', score: 0 },
              { value: 'TIDAK_PERLU', label: 'Tidak perlu', score: 0 },
            ],
          },
          {
            key: 'statusDokumenLingkungan',
            label: 'Dokumen Lingkungan',
            fieldType: 'DROPDOWN',
            options: [
              { value: 'SUDAH_ADA', label: 'Ada', score: 1 },
              { value: 'RENCANA', label: 'Rencana', score: 0 },
              { value: 'TIDAK_PERLU', label: 'Tidak perlu', score: 0 },
            ],
          },
          {
            key: 'statusLarap',
            label: 'LARAP',
            fieldType: 'DROPDOWN',
            options: [
              { value: 'SUDAH_ADA', label: 'Ada', score: 1 },
              { value: 'RENCANA', label: 'Rencana', score: 0 },
              { value: 'TIDAK_PERLU', label: 'Tidak perlu', score: 0 },
            ],
          },
          {
            key: 'kewenangan',
            label: 'Kewenangan',
            fieldType: 'DROPDOWN',
            options: [
              { value: 'PUSAT', label: 'Pusat', score: 1 },
              { value: 'DAERAH', label: 'Daerah', score: 0 },
            ],
          },
          {
            key: 'kebutuhanTanah',
            label: 'Kebutuhan Tanah',
            fieldType: 'DROPDOWN',
            options: [
              { value: 'false', label: 'Tidak ada', score: 1 },
              { value: 'true', label: 'Ada', score: 0 },
            ],
          },
          {
            key: 'statusStudiLayak',
            label: 'Studi Kelayakan',
            fieldType: 'DROPDOWN',
            options: [
              { value: 'SUDAH_ADA', label: 'Ada', score: 1 },
              { value: 'RENCANA', label: 'Rencana', score: 0 },
              { value: 'TIDAK_PERLU', label: 'Tidak perlu', score: 0 },
            ],
          },
        ],
      },
    ],
  };
}
function tabTematik7691(): TabDef {
  // ponytail: sheet punya 16 baris kriteria Tematik (RPJMN/Renstra/RENJA/
  // PKPN/SIPRO/FKW/FKB/MPA/Tagging Dinamis, granular per opsi). Skema cuma
  // simpan 1 kolom per kelompok (mis. 1 tematikRenjaId, bukan 4 baris
  // terpisah) jadi disederhanakan jadi presence-check per kolom (9 item,
  // score 1 rata — proporsi bobot per kriteria tetap terjaga lewat rasio
  // dapat/maks, cuma resolusinya lebih kasar dari sheet). "SIPRO" dilewati
  // — tidak ada kolom Proyek yang merepresentasikannya.
  return {
    key: 'tematik',
    label: 'Tematik',
    bobot: 0.15,
    sections: [
      {
        key: 'tematik',
        label: 'Tematik',
        items: [
          { key: 'kegiatanPrioritasId', label: 'RPJMN — PN / PP / KP', fieldType: 'CHECKBOX', score: 1 },
          { key: 'indikatorSasaranProgramId', label: 'Indikator Sasaran Program (ISP)', fieldType: 'CHECKBOX', score: 1 },
          { key: 'indikatorSasaranKegiatanId', label: 'Indikator Sasaran Kegiatan (ISK)', fieldType: 'CHECKBOX', score: 1 },
          { key: 'tematikRenjaId', label: 'Tematik RENJA', fieldType: 'CHECKBOX', score: 1 },
          { key: 'pkpnId', label: 'PKPN', fieldType: 'CHECKBOX', score: 1 },
          { key: 'fkb', label: 'FKB', fieldType: 'CHECKBOX', score: 1 },
          { key: 'fkw', label: 'FKW', fieldType: 'CHECKBOX', score: 1 },
          { key: 'mpa', label: 'MPA', fieldType: 'CHECKBOX', score: 1 },
          { key: 'taggingDinamis', label: 'Tagging Dinamis', fieldType: 'CHECKBOX', score: 1 },
        ],
      },
    ],
  };
}

const KATEGORI_JARINGAN = 'pembangunan_jaringan';
const KATEGORI_REHAB = 'rehabilitasi_peningkatan';

function tabValuasi7691(): TabDef {
  return {
    key: 'valuasi',
    label: 'Valuasi Proyek',
    bobot: 0.15,
    sections: [
      {
        key: 'informasi',
        label: 'Informasi Proyek',
        items: [
          {
            key: 'kategoriProyek',
            label: 'Kategori Proyek',
            fieldType: 'DROPDOWN',
            options: [
              { value: KATEGORI_JARINGAN, label: 'Pembangunan jaringan' },
              { value: KATEGORI_REHAB, label: 'Rehabilitasi/Peningkatan jaringan' },
            ],
          },
        ],
      },
      {
        key: 'jaringan',
        label: 'Khusus kategori "pembangunan jaringan"',
        items: [
          {
            key: 'rasioAnggaranOutput',
            label: 'Rasio anggaran terhadap output < standar',
            fieldType: 'FIELDBOX',
            score: 2,
            thresholdValue: 20,
            conditionItemId: 'kategoriProyek',
            conditionValue: KATEGORI_JARINGAN,
          },
          {
            key: 'rasioAnggaranOutcome',
            label: 'Rasio anggaran terhadap outcome < standar',
            fieldType: 'FIELDBOX',
            score: 2,
            thresholdValue: 1,
            conditionItemId: 'kategoriProyek',
            conditionValue: KATEGORI_JARINGAN,
          },
          {
            key: 'rasioOutputOutcome',
            label: 'Rasio outcome terhadap output < standar',
            fieldType: 'FIELDBOX',
            score: 2,
            thresholdValue: 30,
            conditionItemId: 'kategoriProyek',
            conditionValue: KATEGORI_JARINGAN,
          },
        ],
      },
      {
        key: 'rehab',
        label: 'Khusus kategori "rehabilitasi/peningkatan jaringan"',
        items: [
          {
            key: 'rasioAnggaranOutput',
            label: 'Rasio anggaran terhadap output < standar',
            fieldType: 'FIELDBOX',
            score: 2,
            thresholdValue: 4.5,
            conditionItemId: 'kategoriProyek',
            conditionValue: KATEGORI_REHAB,
          },
          {
            key: 'rasioAnggaranOutcome',
            label: 'Rasio anggaran terhadap outcome < standar',
            fieldType: 'FIELDBOX',
            score: 2,
            thresholdValue: 0.1,
            conditionItemId: 'kategoriProyek',
            conditionValue: KATEGORI_REHAB,
          },
          {
            key: 'rasioOutputOutcome',
            label: 'Rasio outcome terhadap output < standar',
            fieldType: 'FIELDBOX',
            score: 2,
            thresholdValue: 30,
            conditionItemId: 'kategoriProyek',
            conditionValue: KATEGORI_REHAB,
          },
        ],
      },
    ],
  };
}
function tabKinerja7691(): TabDef {
  const jaringanItems: ItemDef[] = [
    'Proyek menambah luas baku sawah (LBS) beririgasi',
    'Proyek sinkron dengan pengembangan irigasi tersier dan cetak sawah',
    'Proyek bersifat multiguna dan multisektor',
    'Proyek memiliki sistem efisiensi penggunaan air irigasi',
    'Lokasi proyek memiliki sistem kelembagaan yang matang',
  ].map((label, i) => ({
    key: `kinerjaJaringan${i + 1}`,
    label,
    fieldType: 'CHECKBOX' as FormFieldType,
    score: 1,
    conditionItemId: 'kategoriProyek',
    conditionValue: KATEGORI_JARINGAN,
  }));
  const rehabItems: ItemDef[] = [
    'Proyek menaikan nilai IKSI lebih dari 30%',
    'Proyek menaikkan indeks pertanaman (IP) lebih dari 50%',
    'Proyek bersifat multiguna dan multisektor',
    'Proyek memiliki sistem efisiensi penggunaan air irigasi',
    'Lokasi proyek memiliki sistem kelembagaan yang matang',
  ].map((label, i) => ({
    key: `kinerjaRehab${i + 1}`,
    label,
    fieldType: 'CHECKBOX' as FormFieldType,
    score: 1,
    conditionItemId: 'kategoriProyek',
    conditionValue: KATEGORI_REHAB,
  }));
  return {
    key: 'kinerja',
    label: 'Kinerja Proyek',
    bobot: 0.15,
    sections: [
      { key: 'jaringan', label: 'Khusus kategori "pembangunan jaringan"', items: jaringanItems },
      { key: 'rehab', label: 'Khusus kategori "rehabilitasi/peningkatan jaringan"', items: rehabItems },
    ],
  };
}

function template7691(): TabDef[] {
  return [
    tabStrukturalIdentitas(),
    tabDasarPelaksanaan7691(),
    tabStrukturalLokasi(),
    tabKesiapanTeknis7691(),
    tabTematik7691(),
    tabStrukturalPemaketan(),
    tabValuasi7691(),
    tabKinerja7691(),
    tabStrukturalDokumen(),
    tabEvaluasiMarker(),
  ];
}

/** Kegiatan lain yang sudah punya data lama (7692/7693/7694): Dasar/
 * Kesiapan/Tematik dari EvaluasiItem lama (checkbox datar, skor
 * dipertahankan); Lokasi/Pemaketan/Dokumen/Valuasi/Kinerja/Evaluasi disalin
 * dari kerangka 7691 (isi bisa disesuaikan lagi lewat kanvas). */
function templateDariDataLama(kegiatanId: string): TabDef[] {
  const items = oldDump!.item.filter((i) => i.kegiatanId === kegiatanId);
  const metodeName = new Map(oldDump!.metode.map((m) => [m.id, m.name]));
  const byMetode = (nama: string) =>
    items.filter((i) => metodeName.get(i.metodeId) === nama);

  const checklistTab = (
    key: string,
    label: string,
    bobot: number,
    metodeNama: string,
  ): TabDef => ({
    key,
    label,
    bobot,
    sections: [
      {
        key: 'kriteria',
        label: 'Kriteria',
        items: byMetode(metodeNama).map((i, idx) => ({
          key: `${key}Legacy${idx + 1}`,
          label: i.name,
          fieldType: 'CHECKBOX' as FormFieldType,
          score: i.score,
        })),
      },
    ],
  });

  return [
    tabStrukturalIdentitas(),
    checklistTab('dasar', 'Dasar Pelaksanaan', 0.3, 'Urgensitas'),
    tabStrukturalLokasi(),
    checklistTab('kesiapan', 'Kesiapan Teknis', 0.25, 'Kesiapan Teknis'),
    checklistTab('tematik', 'Tematik', 0.15, 'Tematik'),
    tabStrukturalPemaketan(),
    tabValuasi7691(),
    tabKinerja7691(),
    tabStrukturalDokumen(),
    tabEvaluasiMarker(),
  ];
}

const FORCE = process.argv.includes('--force');

async function seedKegiatan(kegiatanId: string, tabs: TabDef[]) {
  const existing = await prisma.formTemplate.findUnique({
    where: { kegiatanId },
  });
  if (existing && !FORCE) {
    // Skip diam-diam kalau template sudah ada & bukan --force: script ini
    // deleteMany+create ulang SELURUH tree, jadi kalau dijalankan lagi
    // begitu saja akan MENGHAPUS section/item yang sudah ditambah admin
    // lewat kanvas Master Data (pernah kejadian nyata). Pakai --force
    // hanya kalau memang sengaja mau menimpa ulang dari nol.
    console.log(`  -> ${kegiatanId}: SKIP (template sudah ada, pakai --force untuk menimpa)`);
    return;
  }
  console.log(`  -> ${kegiatanId}: ${tabs.length} tab${existing ? ' (menimpa, --force)' : ''}`);
  if (DRY) return;

  await prisma.formTemplate.deleteMany({ where: { kegiatanId } });
  await prisma.formTemplate.create({
    data: {
      kegiatanId,
      tabs: {
        create: tabs.map((t, ti) => ({
          key: t.key,
          label: t.label,
          order: ti,
          bobot: t.bobot,
          sections: {
            create: t.sections.map((s, si) => ({
              key: s.key,
              label: s.label,
              order: si,
              items: {
                create: s.items.map((it, ii) => ({
                  key: it.key,
                  label: it.label,
                  fieldType: it.fieldType,
                  order: ii,
                  score: it.score ?? null,
                  thresholdValue: it.thresholdValue ?? null,
                  conditionItemId: it.conditionItemId ?? null,
                  conditionValue: it.conditionValue ?? null,
                  options: it.options
                    ? {
                        create: it.options.map((o, oi) => ({
                          value: o.value,
                          label: o.label,
                          order: oi,
                          score: o.score ?? null,
                        })),
                      }
                    : undefined,
                })),
              },
            })),
          },
        })),
      },
    },
  });
}

async function main() {
  console.log(`Seeding Form Proyek templates${DRY ? ' (dry run)' : ''}...`);

  await seedKegiatan('7691', template7691());

  if (oldDump) {
    for (const kegiatanId of ['7692', '7693', '7694']) {
      if (oldDump.item.some((i) => i.kegiatanId === kegiatanId)) {
        await seedKegiatan(kegiatanId, templateDariDataLama(kegiatanId));
      }
    }
  } else {
    console.log(
      '  (OLD_EVALUASI_DUMP_PATH tidak diset/tidak ada — 7692/93/94 dilewati, ' +
        'pakai fitur clone dari 7691 di kanvas Master Data)',
    );
  }

  console.log('Selesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
