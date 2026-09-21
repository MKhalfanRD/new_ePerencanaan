/**
 * Seed 5 label Sumber Usulan Proyek yang dulu jadi enum hardcode
 * (SumberUsulanProyek di schema lama) — dipindah ke master data supaya
 * admin bisa nambah/ubah tanpa migration. Idempotent (upsert by name).
 *
 * Jalankan sekali: npx ts-node prisma/scripts/seed-sumber-usulan-proyek.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAMA: string[] = [
  'Pemerintah Daerah',
  'Kementerian/Lembaga',
  'Masyarakat',
  'Tindak Lanjut Renaksi',
  'Lainnya',
];

async function main() {
  for (const name of NAMA) {
    await prisma.sumberUsulanProyek.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seed sumber usulan proyek OK (${NAMA.length} baris)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
