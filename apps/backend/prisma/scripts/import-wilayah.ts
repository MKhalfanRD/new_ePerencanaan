/**
 * Import SEKALI JALAN data wilayah administratif Indonesia (provinsi, kab/kota,
 * kecamatan, desa) dari emsifa.com ke database lokal.
 *
 * Kenapa: WilayahService sebelumnya memproxy data ini live dari emsifa.com
 * setiap kali dibutuhkan (dengan cache Redis 7 hari). Ini bikin fitur
 * reverse-geocode & cascading dropdown wilayah bergantung pada TLS chain &
 * DNS emsifa.com yang bermasalah di beberapa jaringan (lihat dokumen analisis
 * bagian "Update — Perbaikan Fitur Reverse Geocode Otomatis"). Solusi jangka
 * panjang: import sekali ke DB sendiri, lalu WilayahService baca dari sana.
 *
 * Cara pakai:
 *   1. Pastikan skema sudah dimigrasikan: npx prisma migrate dev
 *   2. Jalankan dari mesin yang koneksinya ke emsifa.com normal (mis. bukan
 *      di jaringan kantor yang mem-filter DNS-nya):
 *        npx ts-node prisma/scripts/import-wilayah.ts
 *   3. Sekali sukses, data ini tidak perlu diimpor ulang (wilayah admin
 *      Indonesia jarang berubah). Untuk refresh, jalankan lagi — script ini
 *      idempotent (pakai upsert).
 *
 * Catatan:
 *   - Total datanya besar (34 provinsi, ~514 kab/kota, ~7000+ kecamatan,
 *     ~83000+ desa/kelurahan) — proses ini bisa makan waktu 15-30 menit
 *     tergantung koneksi, karena emsifa.com tidak punya endpoint "semua
 *     desa sekaligus" (harus diambil per kecamatan).
 *   - Resumable: kalau proses terhenti di tengah jalan (mis. koneksi putus),
 *     jalankan ulang saja — level yang sudah pernah diimpor akan dilewati.
 *   - Dipisah dari WilayahService supaya WilayahService sendiri tidak perlu
 *     tahu apa pun soal https-agent/CA custom setelah data ini ada di DB.
 */
import { PrismaClient } from '@prisma/client';
import * as https from 'https';
import * as tls from 'tls';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const BASE_URL = 'https://www.emsifa.com/api-wilayah-indonesia/api';

// Sama seperti di wilayah.service.ts: emsifa.com (di belakang Cloudflare)
// kadang tidak mengirim intermediate cert lengkap. Kalau file CA tambahan
// tersedia, pakai; kalau tidak ada / tetap gagal, coba lagi tanpa agent
// custom (kadang Cloudflare edge server yang beda kebetulan kirim chain
// lengkap) sebelum benar-benar menyerah pada satu URL.
const EXTRA_CA_DIR = path.join(__dirname, '..', '..', 'certs');
let extraCaList: string[] = [];
try {
  extraCaList = fs
    .readdirSync(EXTRA_CA_DIR)
    .filter((f) => f.endsWith('.pem'))
    .map((f) => fs.readFileSync(path.join(EXTRA_CA_DIR, f), 'utf8'));
  if (extraCaList.length) {
    console.log(
      `[import-wilayah] Memuat ${extraCaList.length} CA tambahan dari ${EXTRA_CA_DIR}`,
    );
  }
} catch {
  // folder certs/ belum ada — lanjut tanpa CA tambahan
}
const patchedAgent = new https.Agent({
  ca: [...tls.rootCertificates, ...extraCaList],
});

interface WilayahMasterItem {
  id: string;
  name: string;
}

function fetchJson(url: string, useAgent: https.Agent | undefined): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, useAgent ? { agent: useAgent } : {}, (res) => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode} untuk ${url}`));
        res.resume();
        return;
      }
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Timeout')));
  });
}

// Coba dengan CA custom dulu, kalau gagal karena error TLS coba lagi dengan
// agent default (undici/https bawaan) sebagai fallback terakhir.
async function fetchJsonWithRetry(
  path: string,
  attempts = 3,
): Promise<WilayahMasterItem[]> {
  const url = `${BASE_URL}${path}`;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJson(url, patchedAgent);
    } catch (err) {
      lastErr = err;
    }
    try {
      return await fetchJson(url, undefined);
    } catch (err) {
      lastErr = err;
    }
    // backoff kecil sebelum retry, hindari membanjiri emsifa.com
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  throw lastErr;
}

async function main() {
  console.log('🌏 Mulai import data wilayah administratif dari emsifa.com...');

  // --- Provinsi ---
  const existingProvinceCount = await prisma.wilayahProvince.count();
  let provinces: WilayahMasterItem[];
  if (existingProvinceCount > 0) {
    console.log(
      `↩️  ${existingProvinceCount} provinsi sudah ada di DB, pakai yang ada (skip fetch ulang).`,
    );
    provinces = await prisma.wilayahProvince.findMany();
  } else {
    provinces = await fetchJsonWithRetry('/provinces.json');
    for (const p of provinces) {
      await prisma.wilayahProvince.upsert({
        where: { id: p.id },
        create: { id: p.id, name: p.name },
        update: { name: p.name },
      });
    }
    console.log(`✅ ${provinces.length} provinsi diimpor.`);
  }

  // --- Kab/Kota per provinsi ---
  for (const province of provinces) {
    const already = await prisma.wilayahRegency.count({
      where: { provinceId: province.id },
    });
    if (already > 0) {
      console.log(`↩️  Kab/kota provinsi ${province.name} sudah ada, skip.`);
      continue;
    }
    const regencies: WilayahMasterItem[] = await fetchJsonWithRetry(
      `/regencies/${province.id}.json`,
    );
    for (const r of regencies) {
      await prisma.wilayahRegency.upsert({
        where: { id: r.id },
        create: { id: r.id, name: r.name, provinceId: province.id },
        update: { name: r.name },
      });
    }
    console.log(`  ✅ ${province.name}: ${regencies.length} kab/kota`);

    // --- Kecamatan per kab/kota ---
    for (const regency of regencies) {
      const alreadyD = await prisma.wilayahDistrict.count({
        where: { regencyId: regency.id },
      });
      if (alreadyD > 0) continue;
      const districts: WilayahMasterItem[] = await fetchJsonWithRetry(
        `/districts/${regency.id}.json`,
      );
      for (const d of districts) {
        await prisma.wilayahDistrict.upsert({
          where: { id: d.id },
          create: { id: d.id, name: d.name, regencyId: regency.id },
          update: { name: d.name },
        });
      }

      // --- Desa/kelurahan per kecamatan ---
      for (const district of districts) {
        const alreadyV = await prisma.wilayahVillage.count({
          where: { districtId: district.id },
        });
        if (alreadyV > 0) continue;
        const villages: WilayahMasterItem[] = await fetchJsonWithRetry(
          `/villages/${district.id}.json`,
        );
        for (const v of villages) {
          await prisma.wilayahVillage.upsert({
            where: { id: v.id },
            create: { id: v.id, name: v.name, districtId: district.id },
            update: { name: v.name },
          });
        }
      }
    }
    console.log(`  ✅ Selesai: ${province.name} (sampai level desa)`);
  }

  const total = {
    provinces: await prisma.wilayahProvince.count(),
    regencies: await prisma.wilayahRegency.count(),
    districts: await prisma.wilayahDistrict.count(),
    villages: await prisma.wilayahVillage.count(),
  };
  console.log('🎉 Import selesai. Total data lokal:', total);
}

main()
  .catch((err) => {
    console.error(
      '❌ Import gagal di tengah jalan. Jalankan ulang script ini untuk melanjutkan dari titik terakhir (idempotent).',
      err,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
