import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ids = [
  '504',
  '505',
  '506',
  '507',
  '508',
  '702',
  '703',
  '704',
  '705',
  '706',
  '707',
  '708',
  '710',
  '711',
  '712',
  '713',
  '714',
  '715',
  '716',
];

async function main() {
  await prisma.alokasi.deleteMany({ where: { roId: { in: ids } } });
  await prisma.indikatorRO.deleteMany({ where: { roId: { in: ids } } });
  const result = await prisma.rO.deleteMany({ where: { id: { in: ids } } });
  console.log(`✅ ${result.count} RO dan data terkait sudah dihapus`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
