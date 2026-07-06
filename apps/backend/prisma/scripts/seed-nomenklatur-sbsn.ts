/**
 * Seed master nomenklatur KRO/RO resmi (sumber: KRO RO SBSN).
 *
 * Berbeda dari prisma/seed.ts (yang untuk data awal dev/demo), script ini
 * khusus mengisi/memperbaiki tabel Kegiatan/KRO/RO dengan nomenklatur RESMI
 * agar proses import Excel (import.service.ts) tidak lagi membuat
 * placeholder seperti "KRO CBR" / "RO 1" untuk kode yang sudah punya nama
 * resmi.
 *
 * Aman dijalankan berkali-kali (upsert) dan aman dijalankan di
 * dev/staging/prod — hanya MENGISI yang belum ada / MEMPERBAIKI code+name,
 * tidak menghapus data project (Alokasi, Planning, dst) karena kroId/roId
 * (id kualifikasi "kegiatan.kro.ro") tidak diubah kalau sudah pernah ada.
 *
 * Jalankan dengan:
 *   npx ts-node prisma/scripts/seed-nomenklatur-sbsn.ts
 *
 * PRASYARAT: migrasi yang memperlebar kolom KRO.id/RO.id/kroId/roId ke
 * VarChar(20) sudah dijalankan (lihat perubahan di schema.prisma), karena
 * id di sini berbentuk "7691.RBS.001" (>10 karakter).
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

const DEFAULT_PROGRAM_ID = 'FC';
const DEFAULT_PROGRAM_NAME = 'FC Ketahanan Sumber Daya Air';

// Nama Kegiatan resmi (dikonfirmasi oleh pengguna).
const KEGIATAN_NAMES: Record<string, string> = {
  '7691': 'Pengembangan Jaringan Irigasi Permukaan, Rawa, dan Non-Padi',
  '7692':
    'Pengendalian Banjir, Lahar, Pengelolaan Drainase Utama Perkotaan, dan Pengaman Pantai',
  '7693': 'Pengembangan Bendungan, Danau, dan Bangunan Penampung Air Lainnya',
  '7694': 'Pengembangan Jaringan Air Tanah dan Air Baku',
  '7695':
    'Operasi dan Pemeliharaan Sarana Prasarana SDA serta Penanggulangan Darurat Akibat Bencana',
};

async function main() {
  const raw = fs.readFileSync(
    path.join(__dirname, 'kro-ro-master.json'),
    'utf-8',
  );
  const groups: KroGroup[] = JSON.parse(raw);

  await prisma.program.upsert({
    where: { id: DEFAULT_PROGRAM_ID },
    update: {},
    create: {
      id: DEFAULT_PROGRAM_ID,
      code: DEFAULT_PROGRAM_ID,
      name: DEFAULT_PROGRAM_NAME,
    },
  });

  const kegiatanSeeded = new Set<string>();
  let kroCount = 0;
  let roCount = 0;

  for (const group of groups) {
    if (!kegiatanSeeded.has(group.kegiatanId)) {
      await prisma.kegiatan.upsert({
        where: { id: group.kegiatanId },
        update: {},
        create: {
          id: group.kegiatanId,
          programId: DEFAULT_PROGRAM_ID,
          code: group.kegiatanId,
          name:
            KEGIATAN_NAMES[group.kegiatanId] ?? `Kegiatan ${group.kegiatanId}`,
        },
      });
      kegiatanSeeded.add(group.kegiatanId);
    }

    // id di-qualify "kegiatan.kroCode" supaya tidak bentrok lintas kegiatan
    // (RBS/RBG muncul berkali-kali di 7691/7692/7693/7694).
    const kroId = `${group.kegiatanId}.${group.kroCode}`;

    await prisma.kRO.upsert({
      where: { id: kroId },
      update: { code: group.kroCode, name: group.kroName },
      create: {
        id: kroId,
        kegiatanId: group.kegiatanId,
        code: group.kroCode,
        name: group.kroName,
      },
    });
    kroCount++;

    for (const ro of group.roList) {
      const roId = `${kroId}.${ro.roCode}`;
      await prisma.rO.upsert({
        where: { id: roId },
        update: { code: ro.roCode, name: ro.roName, kroId },
        create: {
          id: roId,
          kroId,
          code: ro.roCode,
          name: ro.roName,
        },
      });
      roCount++;
    }
  }

  // 7695 tidak punya baris KRO/RO di file referensi (KROROSBSN.xlsx hanya
  // memuat 7691-7694), tapi kegiatannya tetap perlu ada di master supaya
  // siap dipakai kalau nanti ada KRO/RO-nya.
  await prisma.kegiatan.upsert({
    where: { id: '7695' },
    update: {},
    create: {
      id: '7695',
      programId: DEFAULT_PROGRAM_ID,
      code: '7695',
      name: KEGIATAN_NAMES['7695'],
    },
  });
  kegiatanSeeded.add('7695');

  console.log(
    `✅ Nomenklatur resmi ter-seed: ${kegiatanSeeded.size} kegiatan, ${kroCount} KRO, ${roCount} RO.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
