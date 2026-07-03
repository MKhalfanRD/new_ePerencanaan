import { Injectable, HttpException } from '@nestjs/common';
import * as https from 'https';
import * as tls from 'tls';
import * as fs from 'fs';
import * as path from 'path';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

// Sumber data wilayah administratif Indonesia (gratis, tanpa API key)
const BASE_URL = 'https://www.emsifa.com/api-wilayah-indonesia/api';

// Reverse geocoding (koordinat -> alamat) via OpenStreetMap Nominatim (gratis, tanpa API key)
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

// emsifa.com (hosting di belakang Cloudflare) tidak mengirim sertifikat
// intermediate lengkap saat TLS handshake -> Node.js (berbeda dari browser)
// tidak otomatis mengambil intermediate yang hilang lewat AIA, sehingga
// gagal verifikasi ("UNABLE_TO_VERIFY_LEAF_SIGNATURE"). Kita tambahkan
// intermediate cert secara eksplisit di sini, bukan lewat env var
// NODE_EXTRA_CA_CERTS, karena fetch() bawaan Node (berbasis undici) tidak
// selalu konsisten membaca env var tsb di semua versi.
//
// PENTING (temuan lanjutan dari investigasi "Rekomendasi lanjutan"):
// Cloudflare Universal SSL me-rotasi leaf certificate antar beberapa
// kemungkinan intermediate CA tergantung edge server mana yang melayani
// request (mis. Google Trust Services WE1/WR2/WR3, atau Let's Encrypt
// E5/E6/R3/R4) — bukan selalu intermediate yang sama. Nge-pin SATU
// intermediate (WE1 saja, seperti perbaikan sebelumnya) hanya menambal
// chain untuk request yang kebetulan mendarat di edge dengan issuer itu;
// request lain masih bisa UNABLE_TO_VERIFY_LEAF_SIGNATURE.
//
// Ini juga kemungkinan besar penjelasan kenapa level "provinsi" selalu
// terlihat berhasil sementara kota/kecamatan/desa tidak: getProvinces()
// hasilnya di-cache di Redis 7 hari dan datanya kecil (34 baris) — begitu
// sekali sukses (mis. saat WE1 baru ditambahkan, atau kebetulan hit edge
// yang cocok), permintaan berikutnya SELALU dilayani dari cache, bukan
// benar-benar menghubungi emsifa.com lagi. Sebaliknya getRegencies/
// getDistricts/getVillages dipanggil dengan ID berbeda-beda tiap kali
// (per provinsi/kota/kecamatan yang dipilih user) sehingga sering cache
// MISS dan benar-benar mencoba TLS handshake baru — yang bisa mendarat di
// edge Cloudflare lain dengan intermediate yang belum di-pin.
// -> Sebelum menyalahkan "root CA belum lengkap", cek dulu isi Redis:
//    `wilayah:provinces` kemungkinan sudah lama ke-cache, sedangkan
//    `wilayah:regencies:*`/`districts:*`/`villages:*` jarang ada.
//
// Solusi paling robust untuk masalah rotasi ini BUKAN menambah lebih banyak
// pin, melainkan menghilangkan ketergantungan pada TLS emsifa.com sama
// sekali saat runtime — lihat `prisma/scripts/import-wilayah.ts` yang meng-
// import data ini sekali ke database lokal. Kode di bawah ini (agent + CA
// tambahan) tetap dipertahankan sebagai fallback bootstrapping sebelum
// import lokal dijalankan, dan tetap dibuat menerima BANYAK file CA
// (bukan cuma satu) supaya lebih tahan terhadap rotasi tsb:
//   - Download intermediate/root yang relevan dan taruh di apps/backend/certs/
//     sebagai file .pem terpisah, semuanya otomatis ikut dimuat:
//       * WE1 (sudah ada): http://i.pki.goog/we1.crt
//       * GTS Root R4:      https://pki.goog/repo/certs/gtsrootr4.pem
//       * GlobalSign Root CA - R4: https://secure.globalsign.com/cacert/root-r4.crt
//     (Sengaja tidak di-hardcode di kode ini — isi sertifikat adalah trust
//     anchor yang sensitif, sebaiknya diunduh & diverifikasi langsung oleh
//     developer dari sumber resminya, bukan disalin dari sini.)
const EXTRA_CA_DIR = path.join(__dirname, '..', '..', 'certs');
let emsifaAgent: https.Agent | undefined;
try {
  const certFiles = fs
    .readdirSync(EXTRA_CA_DIR)
    .filter((f) => f.endsWith('.pem'));
  const extraCas = certFiles.map((f) =>
    fs.readFileSync(path.join(EXTRA_CA_DIR, f), 'utf8'),
  );
  emsifaAgent = new https.Agent({
    ca: [...tls.rootCertificates, ...extraCas],
  });
  console.log(
    `[wilayah] ${extraCas.length} CA tambahan untuk emsifa.com dimuat dari: ${EXTRA_CA_DIR} (${certFiles.join(', ') || '-'})`,
  );
} catch (err) {
  // Folder certs/ belum ada -> fallback ke agent default (perilaku lama)
  emsifaAgent = undefined;
  console.error(
    `[wilayah] GAGAL memuat CA tambahan dari "${EXTRA_CA_DIR}" — akan pakai agent default (kemungkinan tetap error TLS). Detail:`,
    err,
  );
}

interface WilayahMasterItem {
  id: string;
  name: string;
}

export interface LocationSearchResult {
  displayName: string;
  lat: number;
  lng: number;
}
export interface ReverseGeocodeResult {
  provinceId?: string;
  provinceName?: string;
  cityId?: string;
  cityName?: string;
  districtId?: string;
  districtName?: string;
  villageId?: string;
  villageName?: string;
  matchedLevel: 'village' | 'district' | 'city' | 'province' | 'none';
  rawAddress?: Record<string, string>;
  displayName?: string;
}

@Injectable()
export class WilayahService {
  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
  ) {}

  // --- Reverse geocoding ---

  async reverseGeocode(
    lat: number,
    lng: number,
  ): Promise<ReverseGeocodeResult> {
    // Cache per titik (dibulatkan ~11m) supaya tidak spam Nominatim (kebijakan mereka: maks 1 req/detik)
    const cacheKey = `wilayah:reverse:${lat.toFixed(4)}:${lng.toFixed(4)}`;
    // Kalau Redis tidak bisa dihubungi, jangan gagalkan seluruh request —
    // anggap saja tidak ada cache dan lanjut ke Nominatim.
    let cached: ReverseGeocodeResult | null = null;
    try {
      cached = await this.redis.get<ReverseGeocodeResult>(cacheKey);
    } catch (err) {
      console.error(
        '[wilayah/reverse] Gagal mengakses Redis, lanjut tanpa cache:',
        err,
      );
    }
    if (cached) return cached;

    const address = await this.fetchNominatimAddress(lat, lng);
    console.log('[wilayah/reverse] Alamat mentah dari Nominatim:', address);

    const { result, hadError } = await this.matchAddressToWilayah(address);
    console.log('[wilayah/reverse] Hasil pencocokan wilayah:', result);

    // Jangan cache hasil yang parsial akibat error jaringan (mis. emsifa.com
    // gagal dihubungi) — supaya percobaan berikutnya bisa coba lagi sampai
    // dapat hasil lengkap, bukan "terkunci" ke hasil parsial selama 30 hari.
    if (!hadError) {
      try {
        await this.redis.set(cacheKey, result, 60 * 60 * 24 * 30); // cache 30 hari
      } catch (err) {
        console.error('[wilayah/reverse] Gagal menyimpan ke Redis:', err);
      }
    }
    return result;
  }

  private async fetchNominatimAddress(
    lat: number,
    lng: number,
  ): Promise<{ raw: Record<string, string>; displayName: string }> {
    const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&accept-language=id&addressdetails=1`;
    try {
      const res = await fetch(url, {
        headers: {
          // Wajib diisi sesuai kebijakan penggunaan Nominatim
          'User-Agent': 'ePerencanaan-App/1.0 (internal planning tool)',
        },
      });
      if (!res.ok) {
        console.error(
          `[wilayah/reverse] Nominatim membalas status ${res.status} untuk ${url}`,
        );
        throw new HttpException('Gagal reverse geocode lokasi', res.status);
      }
      const data = await res.json();
      return {
        raw: data.address || {},
        displayName: data.display_name || '',
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error(
        '[wilayah/reverse] Tidak bisa menghubungi Nominatim. Kemungkinan server tidak punya akses internet keluar. Detail:',
        err,
      );
      throw new HttpException(
        'Layanan reverse geocoding sedang tidak tersedia',
        503,
      );
    }
  }

  async searchAddress(query: string): Promise<LocationSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = `wilayah:search:${trimmed.toLowerCase()}`;
    try {
      const cached = await this.redis.get<LocationSearchResult[]>(cacheKey);
      if (cached) return cached;
    } catch (err) {
      console.error(
        '[wilayah/search] Gagal mengakses Redis, lanjut tanpa cache:',
        err,
      );
    }

    const url = `${NOMINATIM_SEARCH_URL}?format=jsonv2&q=${encodeURIComponent(
      trimmed,
    )}&countrycodes=id&addressdetails=0&limit=5&accept-language=id`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'ePerencanaan-App/1.0 (internal planning tool)',
        },
      });
      if (!res.ok) {
        console.error(
          `[wilayah/search] Nominatim membalas status ${res.status} untuk ${url}`,
        );
        throw new HttpException('Gagal mencari lokasi', res.status);
      }
      const data = await res.json();
      const results: LocationSearchResult[] = (
        Array.isArray(data) ? data : []
      ).map((item: any) => ({
        displayName: item.display_name as string,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));

      try {
        await this.redis.set(cacheKey, results, 60 * 60 * 24); // cache 1 hari
      } catch (err) {
        console.error('[wilayah/search] Gagal menyimpan ke Redis:', err);
      }
      return results;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.error(
        '[wilayah/search] Tidak bisa menghubungi Nominatim. Detail:',
        err,
      );
      throw new HttpException(
        'Layanan pencarian lokasi sedang tidak tersedia',
        503,
      );
    }
  }

  private async matchAddressToWilayah(address: {
    raw: Record<string, string>;
    displayName: string;
  }): Promise<{ result: ReverseGeocodeResult; hadError: boolean }> {
    const raw = address.raw;
    const provinceName = raw.state || raw.province;
    const cityCandidates = [
      raw.city,
      raw.county,
      raw.regency,
      raw.town,
      raw.municipality,
      raw.district,
      raw.region,
    ].filter((v): v is string => Boolean(v));
    const districtCandidates = [
      raw.city_district,
      raw.municipality,
      raw.subdistrict,
      raw.district,
      raw.suburb,
    ].filter((v): v is string => Boolean(v));
    const villageCandidates = [
      raw.village,
      raw.hamlet,
      raw.neighbourhood,
      raw.suburb,
    ].filter((v): v is string => Boolean(v));

    const result: ReverseGeocodeResult = {
      matchedLevel: 'none',
      rawAddress: raw,
      displayName: address.displayName,
    };

    if (!provinceName) {
      console.warn(
        '[wilayah/reverse] Nominatim tidak mengembalikan field state/province. Field alamat yang ada:',
        Object.keys(raw),
      );
      return { result, hadError: false };
    }

    // Setiap level (provinsi/kota/kecamatan/desa) di-try-catch terpisah.
    // Kalau salah satu level gagal dihubungi (mis. emsifa.com tidak bisa
    // diakses), level-level yang SUDAH berhasil ditemukan tetap dikembalikan
    // ke frontend, bukan ikut hangus jadi error 503 total.
    try {
      const provinces = (await this.getProvinces()) as WilayahMasterItem[];
      const province = this.findBestMatch(provinceName, provinces);
      if (!province) {
        console.warn(
          `[wilayah/reverse] Tidak ada provinsi di data master yang cocok dengan "${provinceName}"`,
        );
        return { result, hadError: false };
      }
      result.provinceId = province.id;
      result.provinceName = province.name;
      result.matchedLevel = 'province';

      const filteredCityCandidates = this.stripCandidatesMatchingParent(
        cityCandidates,
        province.name,
      );
      if (filteredCityCandidates.length === 0)
        return { result, hadError: false };
      const regencies = (await this.getRegencies(
        province.id,
      )) as WilayahMasterItem[];
      const city = this.findBestMatchFromCandidates(
        filteredCityCandidates,
        regencies,
        'kabupaten/kota',
      );
      if (!city) return { result, hadError: false };
      result.cityId = city.id;
      result.cityName = city.name;
      result.matchedLevel = 'city';

      // villageCandidates dipakai di jalur fallback findVillageAcrossCity
      // (parent yang sudah resolve di titik ini adalah KOTA), jadi disaring
      // terhadap nama kota, bukan nama provinsi.
      const villageCandidatesAtCity = this.stripCandidatesMatchingParent(
        villageCandidates,
        city.name,
      );

      const filteredDistrictCandidates = this.stripCandidatesMatchingParent(
        districtCandidates,
        city.name,
      );
      if (filteredDistrictCandidates.length === 0) {
        // Nominatim kadang tidak mengembalikan level kecamatan sama sekali
        // (langsung lompat kabupaten -> desa/dusun) walau nama desanya ada.
        // Daripada berhenti di level kota, coba cari desanya langsung lintas
        // semua kecamatan di kota ini (murah karena data sudah lokal), lalu
        // isi kecamatan dari hasil desa yang ketemu.
        if (villageCandidatesAtCity.length > 0) {
          const found = await this.findVillageAcrossCity(
            city.id,
            villageCandidatesAtCity,
          );
          if (found) {
            result.districtId = found.district.id;
            result.districtName = found.district.name;
            result.villageId = found.village.id;
            result.villageName = found.village.name;
            result.matchedLevel = 'village';
          }
        }
        return { result, hadError: false };
      }
      const districts = (await this.getDistricts(
        city.id,
      )) as WilayahMasterItem[];
      const district = this.findBestMatchFromCandidates(
        filteredDistrictCandidates,
        districts,
        'kecamatan',
      );
      if (!district) {
        // Tidak ada kandidat nama kecamatan yang cocok dengan data master
        // (typo/beda ejaan/field-nya sebenarnya berarti level lain). Tetap
        // coba jalur yang sama seperti di atas sebagai fallback terakhir
        // sebelum menyerah di level kota.
        if (villageCandidatesAtCity.length > 0) {
          const found = await this.findVillageAcrossCity(
            city.id,
            villageCandidatesAtCity,
          );
          if (found) {
            result.districtId = found.district.id;
            result.districtName = found.district.name;
            result.villageId = found.village.id;
            result.villageName = found.village.name;
            result.matchedLevel = 'village';
          }
        }
        return { result, hadError: false };
      }
      result.districtId = district.id;
      result.districtName = district.name;
      result.matchedLevel = 'district';

      // Di sini parent yang sudah resolve adalah KECAMATAN, jadi disaring
      // terhadap nama kecamatan (bukan lagi nama kota).
      const villageCandidatesAtDistrict = this.stripCandidatesMatchingParent(
        villageCandidates,
        district.name,
      );
      if (villageCandidatesAtDistrict.length === 0) {
        return { result, hadError: false };
      }
      const villages = (await this.getVillages(
        district.id,
      )) as WilayahMasterItem[];
      const village = this.findBestMatchFromCandidates(
        villageCandidatesAtDistrict,
        villages,
        'desa/kelurahan',
      );
      if (!village) return { result, hadError: false };
      result.villageId = village.id;
      result.villageName = village.name;
      result.matchedLevel = 'village';

      return { result, hadError: false };
    } catch (err) {
      // Data master wilayah (emsifa.com) gagal dihubungi di salah satu level.
      // `result` di titik ini berisi level tertinggi yang sempat berhasil.
      console.error(
        `[wilayah/reverse] Gagal melanjutkan pencocokan wilayah setelah level "${result.matchedLevel}" (kemungkinan emsifa.com tidak terjangkau):`,
        err,
      );
      return { result, hadError: true };
    }
  }

  // Cari kandidat dengan nama paling mirip di atas ambang batas kemiripan.
  // Perlu karena penamaan Nominatim/OSM tidak selalu identik dengan data emsifa
  // (mis. "Kota Bandung" vs "KOTA BANDUNG", "Jakarta Selatan" vs "KOTA ADM. JAKARTA SELATAN").
  private findBestMatch(
    target: string,
    candidates: WilayahMasterItem[],
  ): WilayahMasterItem | null {
    const normTarget = this.normalizeName(target);
    let best: WilayahMasterItem | null = null;
    let bestScore = 0;

    for (const c of candidates) {
      const normCandidate = this.normalizeName(c.name);
      let score: number;
      if (normCandidate === normTarget) {
        score = 1;
      } else if (
        normCandidate.includes(normTarget) ||
        normTarget.includes(normCandidate)
      ) {
        score = 0.9;
      } else {
        score = this.similarity(normTarget, normCandidate);
      }
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    // Ambang batas minimum supaya tidak asal cocok
    return bestScore >= 0.6 ? best : null;
  }

  // Guard untuk bug false-positive "Maluku": field Nominatim di level bawah
  // (mis. `region` di cityCandidates) kadang cuma MENGULANG nama level
  // ATASNYA yang sudah berhasil resolve (mis. provinsi "Maluku"), bukan
  // benar-benar berisi nama level tsb. Kalau dibiarkan, nama itu tetap
  // dicoba dicocokkan lewat substring match (skor 0.9 di findBestMatch) dan
  // sering "menang" secara kebetulan lawan kabupaten yang namanya
  // mengandung nama provinsi (mis. "Kabupaten Maluku Tengah"), menghasilkan
  // assignment yang KELIHATAN valid tapi sebenarnya salah. Solusinya: buang
  // dulu kandidat yang namanya (setelah normalisasi) sama persis dengan
  // nama level parent yang sudah resolve, SEBELUM dicoba di-match ke level
  // bawahnya.
  private stripCandidatesMatchingParent(
    candidates: string[],
    parentName?: string,
  ): string[] {
    if (!parentName) return candidates;
    const normParent = this.stripPunctuationOnly(parentName);
    const skipped: string[] = [];
    const filtered = candidates.filter((c) => {
      const isDuplicate = this.stripPunctuationOnly(c) === normParent;
      if (isDuplicate) skipped.push(c);
      return !isDuplicate;
    });
    if (skipped.length > 0) {
      console.log(
        `[wilayah/reverse] Skip kandidat yang cuma mengulang nama level atasnya ("${parentName}"): ${skipped.join(', ')}`,
      );
    }
    return filtered;
  }

  // Coba beberapa nama kandidat berurutan (dari field Nominatim yang
  // berbeda-beda, lihat komentar di matchAddressToWilayah) terhadap satu
  // pool data master, kembalikan hasil match pertama yang berhasil. Dipakai
  // karena satu field Nominatim (mis. 'municipality') bisa berarti level
  // administratif berbeda tergantung daerah, jadi kita tidak bisa asumsikan
  // satu field = satu level secara kaku.
  //
  // `debugLabel` opsional: kalau diisi (mis. "kabupaten/kota", "kecamatan",
  // "desa/kelurahan") dan SEMUA kandidat gagal match, cetak log diagnostik
  // berisi kandidat data master TERDEKAT (tanpa ambang batas) dari SELURUH
  // kandidat yang dicoba — bukan cuma kandidat pertama. Awalnya logging ini
  // cuma ada untuk level desa (lewat findVillageAcrossCity); sekarang
  // dipakai juga untuk level kota & kecamatan supaya kegagalan match di
  // level itu (mis. anomali "Pontianak Timur" yang sudah exact-match tapi
  // tetap gagal) bisa didiagnosis dari log tanpa tebak-tebak — apakah
  // datanya memang tidak ada di pool, atau ada tapi kalah skor tipis dari
  // ambang 0.6.
  private findBestMatchFromCandidates(
    candidates: string[],
    pool: WilayahMasterItem[],
    debugLabel?: string,
  ): WilayahMasterItem | null {
    for (const candidate of candidates) {
      const match = this.findBestMatch(candidate, pool);
      if (match) return match;
    }

    if (debugLabel && candidates.length > 0) {
      let nearest: { name: string; score: number; target: string } | null =
        null;
      for (const candidate of candidates) {
        const near = this.debugNearestMatch(candidate, pool);
        if (near && (!nearest || near.score > nearest.score)) {
          nearest = { ...near, target: candidate };
        }
      }
      if (nearest) {
        console.log(
          `[wilayah/reverse] Tidak ada ${debugLabel} yang cukup mirip dengan "${candidates.join('" / "')}". Kandidat terdekat: "${nearest.name}" (skor ${nearest.score.toFixed(2)}, dibandingkan dari target "${nearest.target}", di bawah ambang 0.6)`,
        );
      } else {
        console.log(
          `[wilayah/reverse] Pool ${debugLabel} kosong (tidak ada data master untuk dibandingkan) saat mencoba "${candidates.join('" / "')}"`,
        );
      }
    }

    return null;
  }

  // Sama seperti findBestMatch tapi TANPA ambang batas — cuma dipakai untuk
  // logging diagnostik (lihat komentar `debugLabel` di
  // findBestMatchFromCandidates), supaya gampang bedakan "data memang tidak
  // ada" vs "ada tapi kalah skor tipis".
  private debugNearestMatch(
    target: string,
    candidates: WilayahMasterItem[],
  ): { name: string; score: number } | null {
    const normTarget = this.normalizeName(target);
    let best: WilayahMasterItem | null = null;
    let bestScore = 0;
    for (const c of candidates) {
      const normCandidate = this.normalizeName(c.name);
      const score =
        normCandidate === normTarget
          ? 1
          : normCandidate.includes(normTarget) ||
              normTarget.includes(normCandidate)
            ? 0.9
            : this.similarity(normTarget, normCandidate);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best ? { name: best.name, score: bestScore } : null;
  }

  private normalizeName(name: string): string {
    return name
      .toUpperCase()
      .replace(
        /\b(KABUPATEN|KOTA ADM\.?|KOTA|KECAMATAN|KEC\.?|DESA|KELURAHAN|PROVINSI|ADMINISTRASI|ADM\.?)\b/g,
        '',
      )
      .replace(/[^A-Z0-9]/g, '')
      .trim();
  }
  private stripPunctuationOnly(name: string): string {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .trim();
  }

  // Levenshtein distance -> skor kemiripan 0..1
  private similarity(a: string, b: string): number {
    if (!a.length || !b.length) return 0;
    const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
      new Array(b.length + 1).fill(0),
    );
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    const distance = dp[a.length][b.length];
    return 1 - distance / Math.max(a.length, b.length);
  }

  // Request JSON via modul https langsung (bukan fetch()) supaya bisa pakai
  // `agent` dengan CA tambahan secara eksplisit dan terjamin dipakai.
  private fetchJsonViaHttps(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { agent: emsifaAgent }, (res) => {
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
    });
  }

  private async fetchWithCache(path: string, cacheKey: string) {
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.fetchJsonViaHttps(`${BASE_URL}${path}`);

      // Cache lama karena data wilayah jarang berubah (7 hari)
      await this.redis.set(cacheKey, data, 60 * 60 * 24 * 7);
      return data;
    } catch (err) {
      console.error(
        `[wilayah] Gagal menghubungi ${BASE_URL}${path}. Kemungkinan server tidak punya akses internet ke emsifa.com. Detail:`,
        err,
      );
      throw new HttpException(
        'Layanan data wilayah sedang tidak tersedia',
        503,
      );
    }
  }

  getProvinces() {
    return this.getLocalOrFallback(
      () => this.prisma.wilayahProvince.findMany({ orderBy: { name: 'asc' } }),
      () => this.fetchWithCache('/provinces.json', 'wilayah:provinces'),
    );
  }

  getRegencies(provinceId: string) {
    return this.getLocalOrFallback(
      () =>
        this.prisma.wilayahRegency.findMany({
          where: { provinceId },
          orderBy: { name: 'asc' },
        }),
      () =>
        this.fetchWithCache(
          `/regencies/${provinceId}.json`,
          `wilayah:regencies:${provinceId}`,
        ),
    );
  }

  getDistricts(regencyId: string) {
    return this.getLocalOrFallback(
      () =>
        this.prisma.wilayahDistrict.findMany({
          where: { regencyId },
          orderBy: { name: 'asc' },
        }),
      () =>
        this.fetchWithCache(
          `/districts/${regencyId}.json`,
          `wilayah:districts:${regencyId}`,
        ),
    );
  }

  getVillages(districtId: string) {
    return this.getLocalOrFallback(
      () =>
        this.prisma.wilayahVillage.findMany({
          where: { districtId },
          orderBy: { name: 'asc' },
        }),
      () =>
        this.fetchWithCache(
          `/villages/${districtId}.json`,
          `wilayah:villages:${districtId}`,
        ),
    );
  }

  // Cari desa berdasarkan nama di SELURUH kecamatan dalam satu kota/kabupaten
  // sekaligus, dipakai saat Nominatim tidak mengembalikan (atau salah eja)
  // nama kecamatan tapi nama desanya ada. Hanya jalan kalau data wilayah
  // lokal sudah ter-import (butuh join district->regency); kalau tabel lokal
  // masih kosong, sengaja di-skip (tidak efisien dilakukan lewat proxy live
  // emsifa.com satu-satu per kecamatan).
  private async findVillageAcrossCity(
    cityId: string,
    villageCandidates: string[],
  ): Promise<{
    district: WilayahMasterItem;
    village: WilayahMasterItem;
  } | null> {
    const localCount = await this.prisma.wilayahVillage.count();
    if (localCount === 0) return null;

    const villages = await this.prisma.wilayahVillage.findMany({
      where: { district: { regencyId: cityId } },
      include: { district: true },
    });
    if (villages.length === 0) return null;

    const pool = villages.map((v) => ({ id: v.id, name: v.name }));
    // Logging diagnostik saat gagal sekarang ditangani langsung di
    // findBestMatchFromCandidates lewat debugLabel (dulu ada logika manual
    // terpisah persis di sini — sudah disatukan supaya city/district/village
    // semuanya log dengan format & cara yang sama).
    const match = this.findBestMatchFromCandidates(
      villageCandidates,
      pool,
      'desa/kelurahan (lintas kecamatan)',
    );
    if (!match) return null;

    const found = villages.find((v) => v.id === match.id);
    if (!found) return null;

    return {
      district: { id: found.district.id, name: found.district.name },
      village: { id: found.id, name: found.name },
    };
  }

  // Baca dari tabel wilayah lokal (hasil `prisma/scripts/import-wilayah.ts`)
  // dulu — cepat & tidak bergantung pada emsifa.com sama sekali. Kalau tabel
  // lokal masih kosong (belum pernah di-import), baru fallback ke proxy live
  // ke emsifa.com seperti perilaku lama, supaya fitur tetap jalan sebelum
  // migrasi ke data lokal selesai dijalankan developer.
  private async getLocalOrFallback<T>(
    readLocal: () => Promise<T[]>,
    fetchRemote: () => Promise<any>,
  ): Promise<T[] | any> {
    const local = await readLocal();
    if (local.length > 0) return local;

    console.warn(
      '[wilayah] Tabel wilayah lokal masih kosong — fallback ke proxy live emsifa.com. ' +
        'Jalankan `npx ts-node prisma/scripts/import-wilayah.ts` sekali supaya tidak lagi bergantung pada emsifa.com saat runtime.',
    );
    return fetchRemote();
  }
}
