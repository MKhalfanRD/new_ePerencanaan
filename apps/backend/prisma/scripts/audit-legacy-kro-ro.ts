/**
 * Audit: cari semua KRO/RO dengan id "lama" (belum ter-qualify format
 * "kegiatan.kode" / "kegiatan.kro.kode") yang dibuat oleh proses import/
 * master lama sebelum perbaikan.
 *
 * Jalankan dulu script ini untuk tahu APA SAJA entri yang perlu diperbaiki,
 * lalu isi hasilnya ke MIGRATIONS di fix-legacy-kro-ro.ts.
 *
 * Jalankan dengan: npx ts-node prisma/scripts/audit-legacy-kro-ro.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const kros = await prisma.kRO.findMany({
    include: { kegiatan: true, roList: true },
    orderBy: { kegiatanId: 'asc' },
  });

  const legacyKros = kros.filter((k) => !k.id.includes('.'));

  console.log(
    `\n=== ${legacyKros.length} KRO dengan id lama (perlu dipetakan ke kode resmi) ===\n`,
  );
  for (const k of legacyKros) {
    console.log(
      `KRO id="${k.id}" code="${k.code}" name="${k.name}"  <-- kegiatanId="${k.kegiatanId}" (${k.kegiatan?.name ?? 'kegiatan tidak ditemukan'})`,
    );
    for (const ro of k.roList) {
      console.log(`    RO id="${ro.id}" code="${ro.code}" name="${ro.name}"`);
    }
  }

  // RO yang parent KRO-nya sudah benar (qualified) tapi id RO itu sendiri
  // masih format lama — jaga-jaga kalau ada RO yatim/campuran.
  const orphanRos = await prisma.rO.findMany({
    where: { NOT: { id: { contains: '.' } } },
    include: { kro: true },
  });
  const alreadyListed = new Set(
    legacyKros.flatMap((k) => k.roList.map((r) => r.id)),
  );
  const trulyOrphan = orphanRos.filter((r) => !alreadyListed.has(r.id));

  if (trulyOrphan.length) {
    console.log(
      `\n=== RO id lama lainnya (parent KRO sudah ter-qualify) ===\n`,
    );
    for (const r of trulyOrphan) {
      console.log(
        `RO id="${r.id}" code="${r.code}" name="${r.name}"  <-- kroId="${r.kroId}" (${r.kro?.name})`,
      );
    }
  }

  if (!legacyKros.length && !trulyOrphan.length) {
    console.log(
      'Tidak ada lagi KRO/RO dengan id format lama. Sudah bersih. ✅',
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
