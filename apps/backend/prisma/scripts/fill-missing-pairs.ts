/**
 * Script untuk melengkapi pasangan RENCANA/REALISASI pada alokasi lama
 * yang belum punya pasangannya (nilai 0 sebagai default).
 *
 * Jalankan dengan: npx ts-node prisma/scripts/fill-missing-pairs.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Mencari alokasi yang belum punya pasangan...');

  const allAlokasi = await prisma.alokasi.findMany({
    select: {
      id: true,
      planningId: true,
      roId: true,
      tahun: true,
      status: true,
      outputUnit: true,
      outcomeUnit: true,
    },
  });

  // Kelompokkan berdasarkan planningId+roId+tahun
  const groups = new Map<string, typeof allAlokasi>();
  for (const a of allAlokasi) {
    const key = `${a.planningId}|${a.roId}|${a.tahun}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  let created = 0;

  for (const [, items] of groups) {
    const hasRencana = items.some((i) => i.status === 'RENCANA');
    const hasRealisasi = items.some((i) => i.status === 'REALISASI');

    if (hasRencana && !hasRealisasi) {
      const ref = items.find((i) => i.status === 'RENCANA')!;
      await prisma.alokasi.create({
        data: {
          planningId: ref.planningId,
          roId: ref.roId,
          tahun: ref.tahun,
          status: 'REALISASI',
          rm: 0,
          rmp: 0,
          pln: 0,
          sbsn: 0,
          kpbu: 0,
          total: 0,
          outputUnit: ref.outputUnit,
          outcomeUnit: ref.outcomeUnit,
          catatan: 'Dibuat otomatis sebagai pasangan (migrasi data lama)',
        },
      });
      created++;
    }

    if (hasRealisasi && !hasRencana) {
      const ref = items.find((i) => i.status === 'REALISASI')!;
      await prisma.alokasi.create({
        data: {
          planningId: ref.planningId,
          roId: ref.roId,
          tahun: ref.tahun,
          status: 'RENCANA',
          rm: 0,
          rmp: 0,
          pln: 0,
          sbsn: 0,
          kpbu: 0,
          total: 0,
          outputUnit: ref.outputUnit,
          outcomeUnit: ref.outcomeUnit,
          catatan: 'Dibuat otomatis sebagai pasangan (migrasi data lama)',
        },
      });
      created++;
    }
  }

  console.log(`✅ Selesai! ${created} alokasi pasangan berhasil dibuat.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
