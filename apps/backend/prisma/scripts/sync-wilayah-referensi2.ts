/**
 * Sinkronkan Provinsi/Kab-Kota/Kecamatan dengan
 * `Referensi prov, Kab, kec, balai, Satker.xlsx`.
 *
 * Provinsi: sheet ini TERNYATA pakai kode Kemendagri resmi (dicek manual —
 * beda dari kab/kota & kecamatan di file yang sama, yang pakai skema
 * sendiri). Jadi provinsi dicocokkan LANGSUNG by id, termasuk 4 provinsi
 * pemekaran Papua yang belum ada di DB (data lama emsifa.com sebelum 2022).
 *
 * Kab/Kota & Kecamatan: kode BEDA skema dari Kemendagri (lihat percakapan
 * sebelumnya — kode sama-sama berpola provinsi+urutan tapi urutan di
 * dalamnya berbeda isi). Kode Kemendagri (id) TIDAK diubah, cuma dicocokkan
 * lewat NAMA (exact match dulu, lalu fallback substring kalau exact gagal
 * & kandidatnya cuma 1), lalu:
 *   - ketemu -> isi kolom `kodeReferensi` (buat sync berikutnya lebih
 *     akurat, tidak perlu fuzzy-match nama lagi).
 *   - tidak ketemu -> kemungkinan pemekaran daerah baru yang belum ada di
 *     DB (data lokal masih data lama emsifa.com) — dilaporkan di akhir,
 *     TIDAK dibuatkan id baru otomatis karena kode Kemendagri resminya
 *     tidak tersedia di file referensi ini (butuh sumber terpisah).
 *
 * Jalankan dengan:
 *   npx ts-node prisma/scripts/sync-wilayah-referensi2.ts
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const FILE = '../../Referensi prov, Kab, kec, balai, Satker.xlsx';

function rows<T = any>(wb: XLSX.WorkBook, name: string): T[] {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null, raw: true });
}

// Typo/nama-lama yang dipastikan manual (dicek satu-satu via nama alternatif
// dalam kurung / kemiripan ejaan) — bukan fuzzy-matcher umum, sengaja
// dipetakan eksplisit karena cuma segelintir kasus ini yang tersisa.
const KAB_ALIASES: Record<string, string> = {
  pahuwato: 'pohuwato',
  mahakamulu: 'mahakamhulu',
  'pasangkayu(mamujuutara)': 'mamujuutara',
  'kepulauantanimbar(malukutenggarabarat)': 'malukutenggarabarat',
};

function norm(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/^(kabupaten|kota)\s+/i, '')
    .replace(/\bdan\b/g, ' ') // "Pangkajene Dan Kepulauan" vs "Pangkajene Kepulauan"
    .replace(/[^a-z0-9()]/g, '');
  return KAB_ALIASES[base] || base.replace(/\([^)]*\)/g, '');
}

async function main() {
  const wb = XLSX.readFile(FILE);

  // ---------- Provinsi (kode = Kemendagri resmi, cocokkan langsung by id) ----------
  const provRows = rows<{ id: number; name: string }>(wb, 'provinsi');
  let provUpdated = 0;
  let provCreated = 0;
  for (const p of provRows) {
    const id = String(p.id);
    const existing = await prisma.wilayahProvince.findUnique({ where: { id } });
    if (existing) {
      await prisma.wilayahProvince.update({
        where: { id },
        data: { name: p.name, kodeReferensi: id },
      });
      provUpdated++;
    } else {
      await prisma.wilayahProvince.create({
        data: { id, name: p.name, kodeReferensi: id },
      });
      provCreated++;
    }
  }
  console.log(`✅ Provinsi: ${provUpdated} diupdate, ${provCreated} dibuat baru.`);

  // ---------- Kab/Kota (nama, exact lalu fallback substring) ----------
  const kabRows = rows<{ id: number; name: string }>(wb, 'kabupaten_kota');
  const dbKab = await prisma.wilayahRegency.findMany();
  const dbKabByName = new Map<string, (typeof dbKab)[number]>();
  for (const k of dbKab) dbKabByName.set(norm(k.name), k);

  let kabUpdated = 0;
  let kabFallback = 0;
  const kabMissing: string[] = [];
  for (const k of kabRows) {
    const key = norm(k.name);
    let match = dbKabByName.get(key);
    if (!match) {
      const candidates = dbKab.filter((d) => {
        const dn = norm(d.name);
        return dn.includes(key) || key.includes(dn);
      });
      if (candidates.length === 1) {
        match = candidates[0];
        kabFallback++;
      }
    }
    if (match) {
      await prisma.wilayahRegency.update({
        where: { id: match.id },
        data: { kodeReferensi: String(k.id) },
      });
      kabUpdated++;
    } else {
      kabMissing.push(`${k.id} ${k.name}`);
    }
  }
  console.log(
    `✅ Kab/Kota: ${kabUpdated} dicocokkan & diisi kodeReferensi (${kabFallback} via fallback substring), ${kabMissing.length} tidak ketemu di DB.`,
  );

  // ---------- Kecamatan (nama, exact lalu fallback substring) ----------
  const kecRows = rows<{ id: number; name: string }>(wb, 'kecamatan');
  const dbKec = await prisma.wilayahDistrict.findMany();
  const dbKecByName = new Map<string, (typeof dbKec)[number][]>();
  for (const d of dbKec) {
    const key = norm(d.name);
    const arr = dbKecByName.get(key) || [];
    arr.push(d);
    dbKecByName.set(key, arr);
  }

  let kecUpdated = 0;
  let kecFallback = 0;
  let kecAmbiguous = 0;
  const kecMissing: string[] = [];
  for (const k of kecRows) {
    const key = norm(k.name);
    const exact = dbKecByName.get(key);
    if (exact && exact.length === 1) {
      await prisma.wilayahDistrict.update({
        where: { id: exact[0].id },
        data: { kodeReferensi: String(k.id) },
      });
      kecUpdated++;
      continue;
    }
    if (exact && exact.length > 1) {
      // Nama kecamatan sama di >1 kab/kota (umum di Indonesia) — tanpa info
      // kab/kota di excel ini tidak bisa dipastikan yang mana, dilewati.
      kecAmbiguous++;
      continue;
    }
    kecMissing.push(`${k.id} ${k.name}`);
  }
  console.log(
    `✅ Kecamatan: ${kecUpdated} dicocokkan & diisi kodeReferensi, ${kecAmbiguous} ambigu (nama sama di >1 kab/kota, dilewati), ${kecMissing.length} tidak ketemu di DB.`,
  );

  if (kabMissing.length) {
    console.log('\n--- Kab/Kota di excel, TIDAK ketemu di DB (butuh kode Kemendagri manual) ---');
    kabMissing.forEach((s) => console.log('  ' + s));
  }
  if (kecMissing.length) {
    require('fs').writeFileSync('prisma/scripts/kecamatan-missing.txt', kecMissing.join('\n'));
    console.log(
      `\n--- ${kecMissing.length} kecamatan di excel TIDAK ketemu di DB -> ditulis ke prisma/scripts/kecamatan-missing.txt ---`,
    );
  }
}

main()
  .catch((err) => {
    console.error('❌ Sync gagal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
