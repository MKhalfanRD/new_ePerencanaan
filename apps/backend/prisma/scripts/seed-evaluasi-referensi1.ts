/**
 * Import master item evaluasi (Multi Criteria Analysis) dari
 * `referensi 1.xlsx`, sheet "evaluasi Irwa/supan/benda/atab" ke tabel
 * `evaluasi_item`.
 *
 * Pemetaan sheet -> kegiatan:
 *   evaluasi Irwa  -> 7691 (Irigasi & Rawa)
 *   evaluasi supan -> 7692 (Sungai & Pantai)
 *   evaluasi benda -> 7693 (Bendungan)
 *   evaluasi atab  -> 7694 (Air Tanah & Air Baku)
 *
 * Empat kriteria selalu di kolom yang sama (blok tiap 5 kolom): Urgensitas,
 * Kesiapan Teknis, Tematik, Valuasi. Letak kolom "Score" berbeda antar
 * sheet (Irwa punya kolom "ada/tidak ada" tambahan), makanya dicari dari
 * baris header, bukan di-hardcode.
 *
 * Bobot metode (40/20/20/20) ada di tabel master `metode_evaluasi`
 * (lihat migration 20260915010000_metode_evaluasi_master), bukan konstanta
 * di kode lagi — kalau id metode berubah, sesuaikan MERODE_ID di bawah.
 *
 * Cara pakai:
 *   1. npx prisma migrate dev
 *   2. npx ts-node prisma/scripts/seed-evaluasi-referensi1.ts
 *      (tambah --dry untuk cuma menampilkan hasil parsing, tanpa tulis DB)
 */
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const FILE = path.resolve(__dirname, '../../../../referensi 1.xlsx');

const SHEET_KEGIATAN: Record<string, string> = {
  'evaluasi Irwa': '7691',
  'evaluasi supan': '7692',
  'evaluasi benda': '7693',
  'evaluasi atab': '7694',
};

/** Id metode_evaluasi seed bawaan migrasi — cuma label untuk log, kolom
 * DB-nya `metodeId`. */
const METODE_ID: Record<string, string> = {
  URGENSITAS: 'metode_urgensitas',
  KESIAPAN_TEKNIS: 'metode_kesiapan_teknis',
  TEMATIK: 'metode_tematik',
  VALUASI: 'metode_valuasi',
};

/** Blok kriteria: kolom awal tiap kriteria di sheet, urut kiri ke kanan. */
const BLOK: { kriteria: keyof typeof METODE_ID; col: number }[] = [
  { kriteria: 'URGENSITAS', col: 0 },
  { kriteria: 'KESIAPAN_TEKNIS', col: 5 },
  { kriteria: 'TEMATIK', col: 10 },
  { kriteria: 'VALUASI', col: 15 },
];

type Row = any[];
const teks = (v: any) => String(v ?? '').trim();

/** Buang penomoran "1. " di depan nama item. */
const bersihkan = (s: string) => teks(s).replace(/^\d+\.\s*/, '');

/** Baris penutup blok — setelah ini bukan item lagi. */
const penutup = (s: string) => /^(maksimum|total)\s+score/i.test(teks(s));

export function parseSheet(rows: Row[]) {
  const headerIdx = rows.findIndex(
    (r) => /^sumber usulan proyek$/i.test(teks(r[0])),
  );
  if (headerIdx < 0) throw new Error('Baris header tidak ditemukan');
  const header = rows[headerIdx];

  const items: {
    metodeId: string;
    name: string;
    score: number;
  }[] = [];

  for (const { kriteria, col } of BLOK) {
    // Kolom "Score" dicari di dalam blok 5 kolom milik kriteria ini.
    let scoreCol = -1;
    for (let c = col + 1; c < col + 5; c++) {
      if (/^score$/i.test(teks(header[c]))) {
        scoreCol = c;
        break;
      }
    }
    if (scoreCol < 0) throw new Error(`Kolom Score ${kriteria} tidak ketemu`);

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const nama = teks(rows[r]?.[col]);
      if (!nama || penutup(nama)) break;
      // "dst.." di sheet supan/benda/atab cuma placeholder, bukan item nyata.
      if (/^dst\.*$/i.test(nama)) continue;
      items.push({
        metodeId: METODE_ID[kriteria],
        name: bersihkan(nama),
        score: Number(rows[r][scoreCol]) || 1,
      });
    }
  }
  return items;
}

async function main() {
  const wb = XLSX.readFile(FILE);

  for (const [sheet, kodeKegiatan] of Object.entries(SHEET_KEGIATAN)) {
    const ws = wb.Sheets[sheet];
    if (!ws) {
      console.warn(`⚠️  Sheet "${sheet}" tidak ada, dilewati`);
      continue;
    }
    const rows = XLSX.utils.sheet_to_json<Row>(ws, {
      header: 1,
      blankrows: false,
      defval: '',
    });
    const items = parseSheet(rows);

    if (DRY) {
      console.log(`\n=== ${sheet} (kegiatan ${kodeKegiatan}) — ${items.length} item`);
      for (const i of items) {
        console.log(`  [${i.metodeId}] ${i.name} (score ${i.score})`);
      }
      continue;
    }

    const kegiatan = await prisma.kegiatan.findFirst({
      where: { code: kodeKegiatan },
    });
    if (!kegiatan) {
      console.warn(
        `⚠️  Kegiatan ${kodeKegiatan} belum ada di master — jalankan sync-nomenklatur-rspp.ts dulu`,
      );
      continue;
    }

    // Ganti total: daftar item ini memang diambil ulang dari excel tiap
    // sinkronisasi. Tagging proyek yang menunjuk item lama ikut terhapus
    // (onDelete: Cascade) — itu disengaja, item yang hilang dari excel
    // memang tidak boleh lagi menyumbang skor.
    await prisma.evaluasiItem.deleteMany({ where: { kegiatanId: kegiatan.id } });
    await prisma.evaluasiItem.createMany({
      data: items.map((i) => ({ ...i, kegiatanId: kegiatan.id })),
    });
    console.log(`✅ ${sheet} -> kegiatan ${kodeKegiatan}: ${items.length} item`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
