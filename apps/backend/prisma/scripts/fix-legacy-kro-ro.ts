/**
 * Perbaikan SEMUA entri KRO/RO lama yang salah (bukan cuma satu kasus).
 *
 * Cara pakai:
 *   1. Jalankan `npx ts-node prisma/scripts/audit-legacy-kro-ro.ts` dulu,
 *      untuk melihat semua KRO/RO dengan id format lama yang masih ada.
 *   2. Untuk tiap entri yang ditemukan, tentukan kode RESMI yang benar
 *      (code KRO 3 huruf spt "RBS"/"RBG"/"RBH", code RO 3 digit spt "001"),
 *      lalu tambahkan ke array MIGRATIONS di bawah. Anda cukup isi KODE —
 *      nama lengkapnya otomatis diambil dari kro-ro-master.json (referensi
 *      resmi), jadi tidak perlu ketik ulang nama.
 *   3. Jalankan: npx ts-node prisma/scripts/fix-legacy-kro-ro.ts
 *
 * Untuk tiap mapping, script akan:
 *   - Membuat (atau memastikan sudah ada) KRO/RO dengan id ter-qualify yang
 *     benar (mis. "7691.RBS", "7691.RBS.001") + nama resmi dari referensi.
 *   - Memindahkan semua IndikatorRO & Alokasi yang masih menunjuk ke id
 *     lama, ke id baru.
 *   - Menghapus baris KRO/RO lama yang salah.
 * Semua dibungkus transaction per-mapping, jadi aman/idempotent — kalau
 * dijalankan ulang, mapping yang sudah pernah diproses (id lama sudah tidak
 * ada) otomatis dilewati.
 *
 * PRASYARAT: sudah jalankan migrasi schema (VarChar(20)) dan
 * seed-nomenklatur-sbsn.ts terlebih dulu.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface RoEntry {
  roCode: string;
  roName: string;
}
interface KroGroup {
  kegiatanId: string;
  kroCode: string;
  kroName: string;
  roList: RoEntry[];
}

const master: KroGroup[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'kro-ro-master.json'), 'utf-8'),
);

function findKroGroup(kegiatanId: string, kroCode: string) {
  return master.find(
    (g) => g.kegiatanId === kegiatanId && g.kroCode === kroCode,
  );
}

interface RoMapping {
  oldRoId: string; // id RO lama yang salah, mis. '1'
  correctRoCode: string; // kode RO resmi, mis. '001'
}
interface KroMigration {
  oldKroId: string; // id KRO lama yang salah, mis. 'CBR'
  kegiatanId: string; // kegiatan yang benar, mis. '7691'
  correctKroCode: string; // kode KRO resmi, mis. 'RBS'
  roMappings: RoMapping[];
}

// ============================================================
// ISI DI SINI — tambahkan SEMUA entri lama yang perlu diperbaiki.
// Ini cuma contoh dari kasus CBR/RO 1 yang sudah kita bahas;
// tambahkan baris lain sesuai hasil audit-legacy-kro-ro.ts.
// ============================================================
const MIGRATIONS: KroMigration[] = [
  {
    oldKroId: 'RBS',
    kegiatanId: '7691',
    correctKroCode: 'RBS',
    roMappings: [
      { oldRoId: '3', correctRoCode: '003' },
      { oldRoId: '503', correctRoCode: '503' },
      { oldRoId: '701', correctRoCode: '701' },
      { oldRoId: '501', correctRoCode: '501' },
      { oldRoId: '502', correctRoCode: '502' },
      { oldRoId: '709', correctRoCode: '709' },
      { oldRoId: '717', correctRoCode: '717' },
      { oldRoId: '718', correctRoCode: '718' },
      { oldRoId: '719', correctRoCode: '719' },
      { oldRoId: '720', correctRoCode: '720' },
      { oldRoId: '721', correctRoCode: '721' },
      { oldRoId: '722', correctRoCode: '722' },
      { oldRoId: '729', correctRoCode: '729' },
      { oldRoId: '724', correctRoCode: '724' },
      { oldRoId: '727', correctRoCode: '727' },
      { oldRoId: '725', correctRoCode: '725' },
      { oldRoId: '728', correctRoCode: '728' },
      { oldRoId: '726', correctRoCode: '726' },
      { oldRoId: '11', correctRoCode: '011' },
      { oldRoId: '723', correctRoCode: '723' },
      { oldRoId: '14', correctRoCode: '014' },
      { oldRoId: '730', correctRoCode: '730' },
      { oldRoId: '731', correctRoCode: '731' },
      { oldRoId: '732', correctRoCode: '732' },
    ],
  },
  {
    oldKroId: 'RBG',
    kegiatanId: '7691',
    correctKroCode: 'RBG',
    roMappings: [
      { oldRoId: '102', correctRoCode: '102' },
      { oldRoId: '101', correctRoCode: '101' },
    ],
  },
  {
    oldKroId: 'RBH',
    kegiatanId: '7692',
    correctKroCode: 'RBH',
    roMappings: [],
  },
];

async function migrateOne(m: KroMigration) {
  const kroRef = findKroGroup(m.kegiatanId, m.correctKroCode);
  if (!kroRef) {
    throw new Error(
      `KRO ${m.kegiatanId}.${m.correctKroCode} tidak ditemukan di kro-ro-master.json — cek lagi kode resminya.`,
    );
  }
  const newKroId = `${m.kegiatanId}.${m.correctKroCode}`;

  await prisma.$transaction(async (tx) => {
    await tx.kRO.upsert({
      where: { id: newKroId },
      update: { code: m.correctKroCode, name: kroRef.kroName },
      create: {
        id: newKroId,
        kegiatanId: m.kegiatanId,
        code: m.correctKroCode,
        name: kroRef.kroName,
      },
    });

    for (const rm of m.roMappings) {
      const roRef = kroRef.roList.find((r) => r.roCode === rm.correctRoCode);
      if (!roRef) {
        throw new Error(
          `RO ${newKroId}.${rm.correctRoCode} tidak ditemukan di referensi — cek lagi kode resminya.`,
        );
      }
      const newRoId = `${newKroId}.${rm.correctRoCode}`;

      await tx.rO.upsert({
        where: { id: newRoId },
        update: { code: rm.correctRoCode, name: roRef.roName, kroId: newKroId },
        create: {
          id: newRoId,
          kroId: newKroId,
          code: rm.correctRoCode,
          name: roRef.roName,
        },
      });

      const oldRo = await tx.rO.findUnique({ where: { id: rm.oldRoId } });
      if (oldRo) {
        const indikator = await tx.indikatorRO.updateMany({
          where: { roId: rm.oldRoId },
          data: { roId: newRoId },
        });
        const alokasi = await tx.alokasi.updateMany({
          where: { roId: rm.oldRoId },
          data: { roId: newRoId },
        });
        await tx.rO.delete({ where: { id: rm.oldRoId } });
        console.log(
          `  ↳ RO "${rm.oldRoId}" -> "${newRoId}" (pindah ${indikator.count} indikator, ${alokasi.count} alokasi)`,
        );
      }
    }

    const oldKro = await tx.kRO.findUnique({ where: { id: m.oldKroId } });
    if (oldKro) {
      // jaga-jaga kalau masih ada RO lain yang belum sempat dipetakan
      // manual di roMappings tapi masih menunjuk ke KRO lama ini
      const sisaRo = await tx.rO.updateMany({
        where: { kroId: m.oldKroId },
        data: { kroId: newKroId },
      });
      await tx.kRO.delete({ where: { id: m.oldKroId } });
      console.log(
        `✅ KRO "${m.oldKroId}" -> "${newKroId}" (${sisaRo.count} RO sisa ikut dipindah)`,
      );
    } else {
      console.log(`- KRO "${m.oldKroId}" sudah tidak ada, dilewati.`);
    }
  });
}

async function main() {
  for (const m of MIGRATIONS) {
    await migrateOne(m);
  }
  console.log(`\nSelesai memproses ${MIGRATIONS.length} mapping.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
