/**
 * Sinkronkan Program/Kegiatan/KRO/RO/Balai/WilayahSungai dengan
 * `Referensi prov, Kab, kec, balai, Satker.xlsx` (sheets: program, giat,
 * kro, ro, m_balai, WS) — dikonfirmasi user setelah dicek: belum ada
 * Planning/Paket/Komponen/IndikatorRO yang mereferensikan KRO/RO/Balai/
 * WilayahSungai, jadi aman diganti total (bukan cuma upsert).
 *
 * Jalankan dengan:
 *   npx ts-node prisma/scripts/sync-master-data-referensi2.ts
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const FILE = '../../Referensi prov, Kab, kec, balai, Satker.xlsx';

function rows<T = any>(wb: XLSX.WorkBook, name: string): T[] {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null, raw: true });
}

async function main() {
  const wb = XLSX.readFile(FILE);

  const programRows = rows<{ kdprogram: string; nmprogram: string }>(wb, 'program');
  for (const p of programRows) {
    await prisma.program.upsert({
      where: { id: p.kdprogram },
      create: { id: p.kdprogram, code: p.kdprogram, name: p.nmprogram.trim() },
      update: { name: p.nmprogram.trim() },
    });
  }
  console.log('Program: ' + programRows.length + ' disinkronkan.');

  const giatRows = rows<{ kdprogram: string; kdgiat: number; nmgiat: string }>(wb, 'giat');
  for (const g of giatRows) {
    const id = String(g.kdgiat);
    await prisma.kegiatan.upsert({
      where: { id },
      create: { id, programId: g.kdprogram, code: id, name: g.nmgiat.trim() },
      update: { programId: g.kdprogram, name: g.nmgiat.trim() },
    });
  }
  console.log('Kegiatan: ' + giatRows.length + ' disinkronkan.');

  const kroRows = rows<{ kdgiat: number; kdkro: string; nmkro: string }>(wb, 'kro');
  const kroIds = new Set(kroRows.map((k) => k.kdgiat + '.' + k.kdkro));
  const deletedKro = await prisma.kRO.deleteMany({ where: { id: { notIn: [...kroIds] } } });
  for (const k of kroRows) {
    const id = k.kdgiat + '.' + k.kdkro;
    await prisma.kRO.upsert({
      where: { id },
      create: { id, kegiatanId: String(k.kdgiat), code: k.kdkro, name: k.nmkro.trim() },
      update: { kegiatanId: String(k.kdgiat), name: k.nmkro.trim() },
    });
  }
  console.log('KRO: ' + kroRows.length + ' disinkronkan (' + deletedKro.count + ' lama dihapus).');

  const roRowsRaw = rows<{ kdgiat: number; kdkro: string; kdro: number | null; nmro: string }>(
    wb,
    'ro',
  );
  const roRowsSkipped = roRowsRaw.filter((r) => r.kdro == null);
  const roRowsOrphan = roRowsRaw.filter(
    (r) => r.kdro != null && !kroIds.has(r.kdgiat + '.' + r.kdkro),
  );
  const roRows = roRowsRaw.filter(
    (r) => r.kdro != null && kroIds.has(r.kdgiat + '.' + r.kdkro),
  );
  if (roRowsSkipped.length) {
    console.log(roRowsSkipped.length + ' baris RO dilewati (kode RO kosong di sumber Excel):');
    roRowsSkipped.forEach((r) =>
      console.log('   - ' + r.kdgiat + '.' + r.kdkro + ' "' + r.nmro + '"'),
    );
  }
  if (roRowsOrphan.length) {
    console.log(
      roRowsOrphan.length + ' baris RO dilewati (kdgiat/kdkro tidak ada di sheet giat/kro Excel, data basi di sumbernya sendiri):',
    );
    roRowsOrphan.forEach((r) =>
      console.log('   - ' + r.kdgiat + '.' + r.kdkro + '.' + r.kdro + ' "' + r.nmro + '"'),
    );
  }
  const roIds = new Set(
    roRows.map((r) => r.kdgiat + '.' + r.kdkro + '.' + String(r.kdro).padStart(3, '0')),
  );
  const deletedRo = await prisma.rO.deleteMany({ where: { id: { notIn: [...roIds] } } });
  for (const r of roRows) {
    const code = String(r.kdro).padStart(3, '0');
    const id = r.kdgiat + '.' + r.kdkro + '.' + code;
    await prisma.rO.upsert({
      where: { id },
      create: { id, kroId: r.kdgiat + '.' + r.kdkro, code, name: r.nmro.trim() },
      update: { kroId: r.kdgiat + '.' + r.kdkro, name: r.nmro.trim() },
    });
  }
  console.log('RO: ' + roRows.length + ' disinkronkan (' + deletedRo.count + ' lama dihapus).');

  const balaiRows = rows<{ KDBALAI: number; NAMABALAI: string }>(wb, 'm_balai');
  const deletedBalai = await prisma.balai.deleteMany({});
  for (const b of balaiRows) {
    await prisma.balai.create({ data: { id: b.KDBALAI, name: b.NAMABALAI.trim() } });
  }
  console.log(
    'Balai: ' + balaiRows.length + ' dibuat ulang (' + deletedBalai.count + ' lama dihapus).',
  );

  const wsRows = rows<{ Kd_WS: string; Nama_WS: string }>(wb, 'WS');
  const deletedWs = await prisma.wilayahSungai.deleteMany({});
  for (const w of wsRows) {
    await prisma.wilayahSungai.create({ data: { code: w.Kd_WS, name: w.Nama_WS.trim() } });
  }
  console.log(
    'Wilayah Sungai: ' + wsRows.length + ' dibuat ulang (' + deletedWs.count + ' lama dihapus).',
  );
}

main()
  .catch((err) => {
    console.error('Sync gagal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
