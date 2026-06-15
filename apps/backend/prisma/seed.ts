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

  // =============================================
  // BALAI
  // =============================================
  const balaiData = [
    {
      id: 1,
      name: 'Balai Wilayah Sungai Sumatera I',
      shortName: 'BWSS1',
      code: 'BS1',
      latitude: 3.5896,
      longitude: 98.6738,
    },
    {
      id: 2,
      name: 'Balai Wilayah Sungai Sumatera II',
      shortName: 'BWSS2',
      code: 'BS2',
      latitude: 0.9424,
      longitude: 100.3718,
    },
    {
      id: 3,
      name: 'Balai Wilayah Sungai Jawa I',
      shortName: 'BWSJ1',
      code: 'BJ1',
      latitude: -6.9175,
      longitude: 107.6191,
    },
  ];

  for (const balai of balaiData) {
    await prisma.balai.upsert({
      where: { id: balai.id },
      update: {},
      create: balai,
    });
  }
  console.log('✅ Balai seeded');

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

  // =============================================
  // NOMENKLATUR: Program > Kegiatan > KRO > RO
  // =============================================
  await prisma.program.upsert({
    where: { id: 'FC' },
    update: {},
    create: { id: 'FC', code: 'FC', name: 'FC Ketahanan Sumber Daya Air' },
  });

  await prisma.kegiatan.upsert({
    where: { id: '7694' },
    update: {},
    create: {
      id: '7694',
      programId: 'FC',
      code: '7694',
      name: 'Pengembangan Jaringan Air Tanah dan Air Baku',
    },
  });

  await prisma.kRO.upsert({
    where: { id: 'CBG' },
    update: {},
    create: {
      id: 'CBG',
      kegiatanId: '7694',
      code: 'CBG',
      name: 'Prasarana Bidang SDA dan Irigasi',
    },
  });

  const ro = await prisma.rO.upsert({
    where: { id: '005' },
    update: {},
    create: {
      id: '005',
      kroId: 'CBG',
      code: '005',
      name: 'Sumur Air Tanah pada Kawasan Metropolitan, Kawasan Perkotaan, dan Kawasan Strategis',
    },
  });

  await prisma.indikatorRO.upsert({
    where: { id: 'ind-001' },
    update: {},
    create: {
      id: 'ind-001',
      roId: ro.id,
      nama: 'Jumlah Kapasitas Prasarana Air Baku yang Dibangun',
      satuan: 'm3/detik',
    },
  });
  console.log('✅ Nomenklatur seeded');

  // =============================================
  // MASTER: Major Project
  // =============================================
  const majorProjects = [
    'Percepatan Pembangunan Infrastruktur Mendukung Smart Living di 10 Wilayah Metropolitan',
    'Pengembangan Infrastruktur di Kawasan Penyangga IKN',
    'Percepatan Pembangunan Infrastruktur di Kota Baru Luar Pulau Jawa: Sofifi',
    'Pengembangan Infrastruktur mendukung 4 Pusat Pemerintahan Baru: DOB Sorong, Nabire, Wamena, Merauke',
    'Pengamanan Pesisir 3 Perkotaan Jawa Bagian Utara: Jakarta, Semarang, Demak',
    'Pengembangan Infrastruktur Wilayah di Sekitar 5 Kawasan Industri',
    'Dukungan Hilirisasi Industri di 7 Cluster Kawasan',
    'Pembangunan Infrastruktur di Pulau 3T dan Daerah Tertinggal',
    'Pemulihan 5 Daerah Aliran Sungai Kritis',
    'Pembangunan 35 Bendungan Multiguna',
  ];

  for (const name of majorProjects) {
    const existing = await prisma.majorProject.findFirst({ where: { name } });
    if (!existing) {
      await prisma.majorProject.create({ data: { name } });
    }
  }
  console.log('✅ Major Projects seeded');

  // =============================================
  // MASTER: Tindak Lanjut
  // =============================================
  const tindakLanjutList = [
    'Peraturan Presiden (PERPRES) Nomor 79 Tahun 2019 tentang Percepatan Pembangunan Ekonomi Kawasan Kendal - Semarang',
    'Peraturan Presiden (PERPRES) Nomor 80 Tahun 2019 tentang Percepatan Pembangunan Ekonomi di Kawasan Gresik - Bangkalan',
    'Peraturan Presiden (PERPRES) Nomor 87 Tahun 2021 tentang Percepatan Pembangunan Kawasan Rebana dan Kawasan Jawa Barat',
    'Peraturan Menteri Koordinator Bidang Perekonomian Nomor 21 Tahun 2022',
    'Peraturan Presiden (PERPRES) Nomor 63 Tahun 2022 tentang Perincian Rencana Induk Ibu Kota Nusantara',
    'Lainnya',
  ];

  for (const name of tindakLanjutList) {
    const existing = await prisma.tindakLanjut.findFirst({ where: { name } });
    if (!existing) {
      await prisma.tindakLanjut.create({ data: { name } });
    }
  }
  console.log('✅ Tindak Lanjut seeded');

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
