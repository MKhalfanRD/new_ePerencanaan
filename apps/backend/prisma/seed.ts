import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // =============================================
  // ROLES
  // =============================================
  const roles = [
    { code: 'ADMINISTRATOR', name: 'Administrator' },
    { code: 'OPERATOR', name: 'Operator' },
    { code: 'VERIFICATOR', name: 'Verifikator' },
    { code: 'VERI1', name: 'Verifikator Level 1' },
    { code: 'VERI2', name: 'Verifikator Level 2' },
    { code: 'VERI3', name: 'Verifikator Level 3' },
    { code: 'SATKER', name: 'Satuan Kerja' },
    { code: 'BALSAT', name: 'Balai Satker' },
    { code: 'KP', name: 'Kepala Pelaksana' },
    { code: 'READONLY', name: 'Read Only' },
    { code: 'MONITORING', name: 'Monitoring' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: { code: role.code, name: role.name },
    });
  }
  console.log('✅ Roles seeded');

  // =============================================
  // USERS
  // =============================================
  const adminRole = await prisma.role.findUnique({
    where: { code: 'ADMINISTRATOR' },
  });
  const verificatorRole = await prisma.role.findUnique({
    where: { code: 'VERIFICATOR' },
  });
  const satkerRole = await prisma.role.findUnique({
    where: { code: 'SATKER' },
  });

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      name: 'Super Admin',
      roleId: adminRole?.id,
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { username: 'verificator' },
    update: {},
    create: {
      username: 'verificator',
      passwordHash: await bcrypt.hash('veri123', 10),
      name: 'Verifikator',
      roleId: verificatorRole?.id,
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { username: 'satker' },
    update: {},
    create: {
      username: 'satker',
      passwordHash: await bcrypt.hash('satker123', 10),
      name: 'Satuan Kerja',
      roleId: satkerRole?.id,
      status: 'ACTIVE',
    },
  });
  console.log('✅ Users seeded');
  console.log('   admin       / admin123');
  console.log('   verificator / veri123');
  console.log('   satker      / satker123');

  // Balai bukan data contoh — diisi dari import Excel atau master data asli,
  // bukan hardcode dev. Lihat juga sync-nomenklatur-rspp.ts untuk nomenklatur.

  // =============================================
  // PERIODE
  // =============================================
  await prisma.periode.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      startYear: 2020,
      endYear: 2024,
      label: '2020-2024',
      isActive: false,
    },
  });
  await prisma.periode.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      startYear: 2025,
      endYear: 2029,
      label: '2025-2029',
      isActive: true,
    },
  });
  console.log('✅ Periode seeded');

  // Nomenklatur Program/Kegiatan/KRO/RO tidak lagi di-hardcode di sini —
  // sumber kebenarannya adalah referensi 1.xlsx (sheet RSPP), diisi lewat
  // `npx ts-node prisma/scripts/sync-nomenklatur-rspp.ts`. Hardcode lama
  // (Kegiatan 7694/KRO CBG/RO 005 dengan id tidak ter-qualify) sudah dibuang
  // karena skema id real pakai id ter-qualify ("<kegiatan>.<kro>.<ro>").

  // Major Project & Tindak Lanjut dibuang — tidak ada dasarnya di DB.xlsx,
  // lihat docs-planning/audit-restrukturisasi-db-xlsx.md §4.

  // =============================================
  // MASTER: Wilayah Sungai
  // =============================================
  const wilayahSungaiList = [
    'Kahayan',
    'Citarum',
    'Brantas',
    'Bengawan Solo',
    'Musi',
    'Mahakam',
    'Barito',
    'Asahan',
    'Ciliwung',
    'Cisadane',
  ];

  for (const name of wilayahSungaiList) {
    const existing = await prisma.wilayahSungai.findFirst({ where: { name } });
    if (!existing) {
      await prisma.wilayahSungai.create({ data: { name } });
    }
  }
  console.log('✅ Wilayah Sungai seeded');

  console.log('\n🎉 Semua data berhasil di-seed!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
