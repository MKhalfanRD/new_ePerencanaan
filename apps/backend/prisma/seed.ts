import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // =============================================
  // ROLES
  // =============================================
  // kegiatanId = cakupan kegiatan role. Diisi = role itu cuma menangani
  // satu kegiatan (mis. OP7691 khusus 7691). SUPER_ADMIN & ADMINISTRATOR
  // sengaja null: cuma dua role itu yang boleh lintas kegiatan.
  const roles: {
    code: string;
    name: string;
    kegiatanId?: string;
    baseRole?: string;
  }[] = [
    { code: 'SUPER_ADMIN', name: 'Super Admin' },
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

  // Role per kegiatan teknis — dibuat kalau kegiatannya sudah ada di master
  // (diisi dari sync-nomenklatur-rspp.ts).
  for (const kd of ['7691', '7692', '7693', '7694', '7695']) {
    const keg = await prisma.kegiatan.findFirst({ where: { code: kd } });
    if (keg) {
      // baseRole wajib: tanpa itu role turunan ditolak semua @Roles().
      roles.push({
        code: `OPERATOR_${kd}`,
        name: `Operator ${kd}`,
        kegiatanId: keg.id,
        baseRole: 'SATKER',
      });
      roles.push({
        code: `VERIFIKATOR_${kd}`,
        name: `Verifikator ${kd}`,
        kegiatanId: keg.id,
        baseRole: 'VERIFICATOR',
      });
    }
  }

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        kegiatanId: role.kegiatanId ?? null,
        baseRole: role.baseRole ?? null,
      },
      create: {
        code: role.code,
        name: role.name,
        kegiatanId: role.kegiatanId ?? null,
        baseRole: role.baseRole ?? null,
      },
    });
  }
  console.log('✅ Roles seeded');

  // =============================================
  // USERS
  // =============================================
  const superAdminRole = await prisma.role.findUnique({
    where: { code: 'SUPER_ADMIN' },
  });
  const adminRole = await prisma.role.findUnique({
    where: { code: 'ADMINISTRATOR' },
  });
  const verificatorRole = await prisma.role.findUnique({
    where: { code: 'VERIFICATOR' },
  });
  const satkerRole = await prisma.role.findUnique({
    where: { code: 'SATKER' },
  });

  // Satu-satunya role yang bisa membuka halaman Log Aktivitas.
  await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      passwordHash: await bcrypt.hash('superadmin123', 10),
      name: 'Super Admin',
      roleId: superAdminRole?.id,
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      name: 'Administrator',
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
  console.log('   superadmin  / superadmin123');
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
