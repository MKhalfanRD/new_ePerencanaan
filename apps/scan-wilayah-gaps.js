/**
 * scan-wilayah-gaps.js
 *
 * Scan otomatis banyak titik tersebar di seluruh Indonesia lewat endpoint
 * `GET /wilayah/reverse` punya sendiri (bukan langsung ke Nominatim), supaya
 * sekali jalan ketemu banyak kasus "field Nominatim belum tertangani"
 * sekaligus — dibanding klik satu-satu manual di peta.
 *
 * CARA PAKAI:
 *   1. Jalankan backend (`npm run start:dev` di apps/backend).
 *   2. Ambil JWT token login kamu (mis. dari localStorage browser setelah
 *      login, atau lewat endpoint /auth/login kalau ada).
 *   3. Jalankan:
 *        # Windows PowerShell
 *        $env:WILAYAH_SCAN_TOKEN="<jwt_token_kamu>"
 *        node scan-wilayah-gaps.js
 *
 *        # atau kalau base URL beda dari default:
 *        $env:WILAYAH_SCAN_BASE_URL="http://localhost:3000"
 *        $env:WILAYAH_SCAN_TOKEN="<jwt_token_kamu>"
 *        node scan-wilayah-gaps.js
 *
 * Script ini SENGAJA dijeda ~1.1 detik antar request (kebijakan fair-use
 * Nominatim: maks 1 req/detik) — total waktu jalan ~3-4 menit untuk daftar
 * titik default di bawah. Jangan diturunkan jedanya.
 *
 * OUTPUT:
 *   - Ringkasan matchedLevel (berapa % sampai desa/kecamatan/kota/provinsi/none)
 *   - Daftar lengkap kasus yang TIDAK sampai desa, dengan raw address-nya
 *   - Daftar field Nominatim yang muncul tapi belum ada di kandidat manapun
 *     (city/district/village) di kode kita — ini yang paling penting untuk
 *     ditindaklanjuti
 *   - File `scan-wilayah-gaps-result.json` berisi semua data mentah, supaya
 *     gampang ditempel/dilampirkan balik ke sesi analisis berikutnya
 */

const http = require("http");
const https = require("https");
const fs = require("fs");

const BASE_URL = process.env.WILAYAH_SCAN_BASE_URL || "http://localhost:3000";
const TOKEN = process.env.WILAYAH_SCAN_TOKEN;
const SAMPLES_PER_ANCHOR = parseInt(
  process.env.WILAYAH_SCAN_SAMPLES_PER_ANCHOR || "5",
  10,
);
const JITTER_DEGREES = parseFloat(
  process.env.WILAYAH_SCAN_JITTER_DEGREES || "0.3",
);
const DELAY_MS = 1100; // jangan diturunkan — kebijakan fair-use Nominatim

if (!TOKEN) {
  console.error(
    "ERROR: set environment variable WILAYAH_SCAN_TOKEN dulu (JWT bearer token login kamu).\n" +
      'Contoh (PowerShell): $env:WILAYAH_SCAN_TOKEN="isi_token_disini"',
  );
  process.exit(1);
}

// Titik pusat 34 ibu kota provinsi, dipakai sebagai jangkar supaya titik
// acak yang di-generate landing di daratan Indonesia (bukan lautan/luar
// negeri), lalu di-jitter kecil di sekitarnya supaya tiap kali dapat
// desa/kecamatan yang berbeda-beda di sekitar ibu kota provinsi tsb.
const ANCHORS = [
  { name: "Aceh", lat: 5.5483, lng: 95.3238 },
  { name: "Sumatera Utara", lat: 3.5952, lng: 98.6722 },
  { name: "Sumatera Barat", lat: -0.9471, lng: 100.4172 },
  { name: "Riau", lat: 0.5071, lng: 101.4478 },
  { name: "Jambi", lat: -1.6101, lng: 103.6131 },
  { name: "Sumatera Selatan", lat: -2.9761, lng: 104.7754 },
  { name: "Bengkulu", lat: -3.7928, lng: 102.2608 },
  { name: "Lampung", lat: -5.4292, lng: 105.261 },
  { name: "Kep. Bangka Belitung", lat: -2.1316, lng: 106.1169 },
  { name: "Kep. Riau", lat: 0.9186, lng: 104.4652 },
  { name: "DKI Jakarta", lat: -6.2088, lng: 106.8456 },
  { name: "Jawa Barat", lat: -6.9175, lng: 107.6191 },
  { name: "Jawa Tengah", lat: -6.9932, lng: 110.4203 },
  { name: "DI Yogyakarta", lat: -7.7956, lng: 110.3695 },
  { name: "Jawa Timur", lat: -7.2575, lng: 112.7521 },
  { name: "Banten", lat: -6.1783, lng: 106.115 },
  { name: "Bali", lat: -8.4095, lng: 115.1889 },
  { name: "NTB", lat: -8.5833, lng: 116.1167 },
  { name: "NTT", lat: -10.1772, lng: 123.607 },
  { name: "Kalimantan Barat", lat: -0.0263, lng: 109.3425 },
  { name: "Kalimantan Tengah", lat: -2.2096, lng: 113.9213 },
  { name: "Kalimantan Selatan", lat: -3.3186, lng: 114.5944 },
  { name: "Kalimantan Timur", lat: -0.5022, lng: 117.1536 },
  { name: "Kalimantan Utara", lat: 3.0731, lng: 117.0453 },
  { name: "Sulawesi Utara", lat: 1.4748, lng: 124.8421 },
  { name: "Sulawesi Tengah", lat: -0.8917, lng: 119.8707 },
  { name: "Sulawesi Selatan", lat: -5.1477, lng: 119.4327 },
  { name: "Sulawesi Tenggara", lat: -3.9985, lng: 122.5129 },
  { name: "Gorontalo", lat: 0.5435, lng: 123.0568 },
  { name: "Sulawesi Barat", lat: -2.8441, lng: 119.232 },
  { name: "Maluku", lat: -3.6954, lng: 128.1814 },
  { name: "Maluku Utara", lat: 0.7833, lng: 127.3833 },
  { name: "Papua Barat", lat: -0.8615, lng: 134.0621 },
  { name: "Papua", lat: -2.5916, lng: 140.6689 },
];

function randomJitter() {
  return (Math.random() * 2 - 1) * JITTER_DEGREES;
}

function buildPoints() {
  const points = [];
  for (const anchor of ANCHORS) {
    for (let i = 0; i < SAMPLES_PER_ANCHOR; i++) {
      points.push({
        anchorName: anchor.name,
        lat: anchor.lat + randomJitter(),
        lng: anchor.lng + randomJitter(),
      });
    }
  }
  return points;
}

function httpGetJson(url, token) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(
      url,
      { headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(
                `HTTP ${res.statusCode}: ${raw.slice(0, 300)} (cek apakah token JWT masih valid)`,
              ),
            );
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("timeout 15s"));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Field yang SUDAH ditangani di kandidat manapun (city/district/village) di
// wilayah.service.ts per sesi analisis ini. Update daftar ini setiap kali
// kode ditambah field baru, supaya script ini tetap akurat mendeteksi field
// yang benar-benar baru.
const KNOWN_CANDIDATE_KEYS = new Set([
  "state",
  "province",
  "city",
  "county",
  "regency",
  "town",
  "municipality",
  "district",
  "region",
  "city_district",
  "subdistrict",
  "suburb",
  "village",
  "hamlet",
  "neighbourhood",
]);

// Field yang diketahui BUKAN nama level administratif (metadata teknis/POI),
// sengaja diabaikan supaya tidak mengotori daftar "field baru yang menarik".
const IGNORED_KEYS = new Set([
  "country",
  "country_code",
  "postcode",
  "road",
  "house_number",
  "amenity",
  "shop",
  "leisure",
  "building",
  "tourism",
  "office",
  "ISO3166-2-lvl3",
  "ISO3166-2-lvl4",
  "ISO3166-2-lvl5",
]);

async function main() {
  const points = buildPoints();
  console.log(
    `Mulai scan ${points.length} titik (${ANCHORS.length} anchor x ${SAMPLES_PER_ANCHOR} sample), jeda ${DELAY_MS}ms antar request...`,
  );
  console.log(
    `Estimasi waktu: ~${Math.ceil((points.length * DELAY_MS) / 1000 / 60)} menit\n`,
  );

  const results = [];
  const levelCounts = {
    village: 0,
    district: 0,
    city: 0,
    province: 0,
    none: 0,
  };
  const unhandledKeyFrequency = new Map(); // key -> {count, examples: [{key,value,displayName}]}
  const incompleteMatches = [];
  let errorCount = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const url = `${BASE_URL}/wilayah/reverse?lat=${p.lat.toFixed(6)}&lng=${p.lng.toFixed(6)}`;
    process.stdout.write(
      `[${i + 1}/${points.length}] ${p.anchorName} (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}) ... `,
    );
    try {
      const result = await httpGetJson(url, TOKEN);
      const level = result.matchedLevel || "none";
      levelCounts[level] = (levelCounts[level] || 0) + 1;
      console.log(level);

      results.push({ anchor: p.anchorName, lat: p.lat, lng: p.lng, result });

      if (level !== "village") {
        incompleteMatches.push({
          anchor: p.anchorName,
          lat: p.lat,
          lng: p.lng,
          result,
        });
      }

      const raw = result.rawAddress || {};
      for (const key of Object.keys(raw)) {
        if (KNOWN_CANDIDATE_KEYS.has(key) || IGNORED_KEYS.has(key)) continue;
        if (!unhandledKeyFrequency.has(key)) {
          unhandledKeyFrequency.set(key, { count: 0, examples: [] });
        }
        const entry = unhandledKeyFrequency.get(key);
        entry.count++;
        if (entry.examples.length < 3) {
          entry.examples.push({
            value: raw[key],
            displayName: result.displayName,
            matchedLevel: level,
          });
        }
      }
    } catch (err) {
      errorCount++;
      console.log(`GAGAL (${err.message})`);
    }

    if (i < points.length - 1) await sleep(DELAY_MS);
  }

  console.log("\n=== RINGKASAN ===");
  console.log(`Total titik: ${points.length}`);
  console.log(`Error/gagal request: ${errorCount}`);
  console.log("Distribusi matchedLevel:");
  for (const [level, count] of Object.entries(levelCounts)) {
    const pct = ((count / points.length) * 100).toFixed(1);
    console.log(`  ${level}: ${count} (${pct}%)`);
  }

  console.log(`\n=== ${incompleteMatches.length} TITIK TIDAK SAMPAI DESA ===`);
  for (const m of incompleteMatches) {
    console.log(
      `- [${m.result.matchedLevel}] ${m.result.displayName || "(tanpa nama)"}`,
    );
    console.log(`  raw: ${JSON.stringify(m.result.rawAddress)}`);
  }

  console.log("\n=== FIELD NOMINATIM YANG BELUM ADA DI KANDIDAT MANAPUN ===");
  if (unhandledKeyFrequency.size === 0) {
    console.log("(tidak ada — semua field yang muncul sudah tertangani)");
  } else {
    const sorted = [...unhandledKeyFrequency.entries()].sort(
      (a, b) => b[1].count - a[1].count,
    );
    for (const [key, entry] of sorted) {
      console.log(`- "${key}" (muncul ${entry.count}x)`);
      for (const ex of entry.examples) {
        console.log(
          `    contoh: "${ex.value}" (matchedLevel saat ini: ${ex.matchedLevel}) — ${ex.displayName}`,
        );
      }
    }
    console.log(
      "\nField-field di atas BELUM tentu perlu ditambahkan sebagai kandidat baru —" +
        "\ncek dulu apakah isinya benar nama wilayah administratif (bukan POI/jalan/dll)" +
        "\nsebelum menambahkannya ke cityCandidates/districtCandidates/villageCandidates.",
    );
  }

  const outputPath = "./scan-wilayah-gaps-result.json";
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        summary: {
          totalPoints: points.length,
          errorCount,
          levelCounts,
        },
        incompleteMatches,
        unhandledKeys: Object.fromEntries(unhandledKeyFrequency),
        allResults: results,
      },
      null,
      2,
    ),
  );
  console.log(`\nHasil lengkap tersimpan di: ${outputPath}`);
  console.log(
    "Kalau mau lanjut diagnosis, tempel/lampirkan file ini ke sesi analisis berikutnya.",
  );
}

main().catch((err) => {
  console.error("Script gagal total:", err);
  process.exit(1);
});
