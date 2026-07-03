tar --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='dist' --exclude='build' --exclude='.turbo' --exclude='node_modules.zip' --exclude='src.zip' --exclude='\*.tsbuildinfo' -czf project.tar.gz apps

## Update — Fix Bug Substring-Match, Fitur Search Lokasi Baru, & Pembersihan Field

> Sesi ini melanjutkan [Update sebelumnya](#update--tuntas-ssl-inspection-import-data-wilayah--perbaikan-reverse-geocode-matching), yang meninggalkan satu bug prioritas tinggi belum diperbaiki: **false-positive substring match** (kasus "Maluku"). Status akhir sesi ini: bug tsb **sudah diperbaiki**, ditemukan **satu regresi baru** dari fix-nya (sudah diperbaiki juga), dan **fitur baru** (search lokasi di peta) selesai dibangun.

### ✅ Fix bug false-positive substring match ("Maluku") — sudah diterapkan

Root cause (dari sesi sebelumnya): field Nominatim di level bawah (mis. `region` di `cityCandidates`) kadang cuma **mengulang** nama level atasnya yang sudah resolve (mis. provinsi "Maluku"), tapi tetap dicoba dicocokkan lewat substring match (skor 0.9 di `findBestMatch`) — dan sering "menang" secara kebetulan lawan kabupaten yang namanya mengandung nama provinsi (mis. "Kabupaten Maluku Barat Daya"), menghasilkan assignment yang **kelihatan valid tapi salah**.

**Verifikasi dari data**: dicek dari `scan-wilayah-gaps-result.json` (170 titik, 34 provinsi × 5 sampel) — 3 dari 5 titik anchor "Maluku" ke-assign salah ke `KABUPATEN MALUKU BARAT DAYA` (cityId `8108`) padahal raw address Nominatim cuma berisi `state: "Maluku"` / `region: "Maluku"`, tanpa info kabupaten sama sekali.

**Fix yang diterapkan** di `apps/backend/src/wilayah/wilayah.service.ts`:

- Fungsi baru `stripCandidatesMatchingParent()` — membuang kandidat yang namanya (setelah normalisasi) sama persis dengan nama level parent yang sudah resolve, **sebelum** dicoba di-match ke level bawahnya. Diterapkan di 3 titik: `cityCandidates` vs `province.name`, `districtCandidates` vs `city.name`, dan `villageCandidates` (baik lewat jalur normal maupun `findVillageAcrossCity`) vs `city.name`/`district.name`.
- Logging diagnostik disatukan lewat parameter opsional `debugLabel` di `findBestMatchFromCandidates()` — kalau semua kandidat di suatu level gagal match, dicetak kandidat data master terdekat + skornya, mencakup level kota & kecamatan (dulu cuma ada untuk desa).

### 🐛 Regresi baru ditemukan dari fix di atas — sudah diperbaiki

**Masalah**: `stripCandidatesMatchingParent()` awalnya membandingkan dua nama pakai `normalizeName()` — fungsi yang juga membuang kata admin generik (`KOTA`/`KABUPATEN`/`KECAMATAN`/dst). Ini menyebabkan dua wilayah **berbeda** yang kebetulan tersusun dari kata sama tapi urutan beda bisa ternormalisasi jadi string identik.

**Kasus nyata yang membuktikan**: Kota Batam punya kecamatan asli bernama **"Batam Kota"**. Simulasi:

```
normalizeName("Kota Batam")  -> "BATAM"
normalizeName("Batam Kota")  -> "BATAM"   (SAMA — padahal kecamatan valid, bukan pengulangan nama kota)
```

Kalau tidak diperbaiki, field `city_district: "Batam Kota"` dari Nominatim akan ikut ter-skip, menyebabkan hasil reverse-geocode berhenti jujur di level kota padahal seharusnya bisa sampai kecamatan — bukan salah data (aman), tapi kurang presisi untuk kasus yang sebetulnya bisa lebih detail.

**Fix**: tambah fungsi pembanding baru `stripPunctuationOnly()` — cuma uppercase + buang spasi/tanda baca, **tanpa** membuang kata admin generik. Dipakai khusus di `stripCandidatesMatchingParent()`, sementara `normalizeName()` asli tetap dipakai di `findBestMatch()` seperti sebelumnya (tidak diubah, supaya fuzzy-match utama tidak kena efek samping).

### ✨ Fitur baru: Search lokasi di peta

Sebelumnya form tambah/edit lokasi (`lokasi-form-dialog.tsx`) cuma punya 3 cara input titik: klik manual di peta, "Lokasi Saya" (geolocation browser), atau isi dropdown wilayah manual — **tidak ada** cara ketik nama tempat untuk lompat ke lokasi (forward geocoding). Fitur ini dibangun dari nol.

**Backend** (`apps/backend/src/wilayah/`):

- `wilayah.service.ts` — method baru `searchAddress(query)`, forward-geocode via endpoint `/search` Nominatim (bukan `/reverse`), hasil di-cache Redis 1 hari (lebih pendek dari cache reverse-geocode 30 hari, karena variasi query teks jauh lebih tinggi). Tipe hasil: `LocationSearchResult[]` (`displayName`, `lat`, `lng`), di-export supaya bisa dipakai sebagai return type publik lintas file.
- `wilayah.controller.ts` — endpoint baru `GET /wilayah/search?q=...`.

**Frontend** (`apps/frontend/src/`):

- `lib/wilayah-api.ts` — method `searchLocation(q)` + tipe `LocationSearchResult`.
- `components/map/location-search-box.tsx` (baru) — input search dengan debounce 500ms (sejalan dengan kebijakan fair-use Nominatim 1 req/detik, minimal 3 karakter sebelum query jalan), dropdown hasil, klik-di-luar untuk menutup dropdown.
- `components/map/map-picker.tsx` — prop baru `flyToTrigger` + `useEffect` terpisah dari effect inisialisasi peta, supaya peta bisa "dipanggil" pindah lokasi & pasang marker dari luar (dipicu tiap kali user pilih hasil pencarian), bukan cuma dari klik manual di peta.
- `components/map/lokasi-form-dialog.tsx` — pasang `<LocationSearchBox>` di atas `<MapPicker>` untuk tipe koordinat `TITIK`; handler `handleSearchSelect` men-trigger `flyTo` sekaligus reuse alur `handlePointChange` yang sudah ada (jadi reverse-geocode & pengisian wilayah otomatis tetap jalan persis seperti klik manual).

Dua input di atas peta sekarang punya peran terpisah: **"Cari nama tempat..."** untuk mencari & memindahkan titik (fungsional, terhubung ke Nominatim), sedangkan field nama lokasi lama murni label teks bebas.

### 🧹 Pembersihan: field "Nama Lokasi (opsional)" dihapus

Field ini (`name`) ternyata tidak dipakai user — dihapus dari `lokasi-form-dialog.tsx`: state `name`, isi awal saat edit (`setName(editData.name || "")`), reset saat form dibuka baru, key `name` di payload submit, dan blok input JSX-nya. Import `Label`/`Input` tetap dipertahankan karena masih dipakai komponen lain di file yang sama (field Latitude/Longitude read-only).

Interface `LokasiData.name?: string` dan fallback `data.name || "Detail Lokasi"` di `lokasi-detail-dialog.tsx` **sengaja dibiarkan** — aman walau field-nya selalu kosong ke depannya, tidak menyebabkan error. Kolom `name` di skema Prisma/database juga belum disentuh (di luar cakupan sesi ini).

### 🛠️ Build error yang ditemukan & diperbaiki selama implementasi

| Error                                                                               | Penyebab                                                                                                                                                                                               | Fix                                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `TS2693`/`TS2365` di `wilayah.service.ts` saat build backend                        | Generic inline multi-baris `this.redis.get<{ displayName: string; ... }[]>(cacheKey)` rusak ke-parse (kemungkinan efek reformat editor)                                                                | Ganti jadi interface bernama `LocationSearchResult`, generic-nya jadi single-token: `this.redis.get<LocationSearchResult[]>(cacheKey)` |
| `TS4053` di `wilayah.controller.ts`                                                 | Interface `LocationSearchResult` di `wilayah.service.ts` dipakai sebagai return type method publik lintas file tapi tidak di-`export`                                                                  | Tambah kata `export` di depan interface                                                                                                |
| `ReferenceError: flyToTrigger is not defined` (runtime browser) di `map-picker.tsx` | Prop `flyToTrigger` sudah ditambahkan ke interface `MapPickerProps` tapi lupa ditambahkan ke daftar destructure parameter function `MapPicker`                                                         | Tambah `flyToTrigger` ke parameter destructure                                                                                         |
| `TS2339: Property 'icon' does not exist` di `review/page.tsx`                       | Bug pre-existing (bukan dari sesi ini) — `statusConfig` dipakai dengan `cfg.icon` tapi tidak satupun dari 5 varian status (`DRAFT`/`SUBMITTED`/`REVISION`/`REJECTED`/`APPROVED`) punya properti `icon` | Tambah properti `icon` (komponen lucide-react) ke tiap varian `statusConfig`, render sebagai `<cfg.icon size={11} />`                  |

### 📋 Status akhir per area (update)

| Area                                                                        | Status                                                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| False-positive substring match ("Maluku")                                   | ✅ Tuntas — `stripCandidatesMatchingParent()`                                                                    |
| Regresi normalisasi ("Batam Kota" vs "Kota Batam")                          | ✅ Tuntas — `stripPunctuationOnly()`                                                                             |
| Logging diagnostik city & district match failure                            | ✅ Diterapkan lewat `debugLabel`                                                                                 |
| Fitur search lokasi (forward geocode) di form tambah/edit lokasi            | ✅ Selesai dibangun (backend + frontend)                                                                         |
| Field "Nama Lokasi (opsional)"                                              | ✅ Dihapus dari form (tidak dipakai)                                                                             |
| Anomali `city_district` Pontianak Timur (dari sesi sebelumnya)              | ❓ Masih belum terjelaskan — logging diagnostik baru sudah tersedia, tapi scan belum diulang untuk mengonfirmasi |
| Audit data planning yang mungkin tercemar bug Maluku (dari sesi sebelumnya) | ⏳ Belum dikerjakan                                                                                              |
| Baseline migration history Prisma (dari sesi sebelumnya)                    | ⏳ Belum dikerjakan, independen                                                                                  |

### 🔜 Rekomendasi lanjutan

1. **Jalankan ulang `scan-wilayah-gaps.js`** sekarang setelah kedua fix (`stripCandidatesMatchingParent` + `stripPunctuationOnly`) live di backend, lalu upload ulang `scan-wilayah-gaps-result.json` — perlu verifikasi: (a) kasus Maluku sudah tidak lagi salah assign ke kabupaten, (b) kasus tipe "Batam Kota" tetap sampai level kecamatan (tidak ke-skip keliru), (c) anomali Pontianak Timur akhirnya kelihatan penyebabnya dari log `debugLabel` yang baru.
2. **Audit data planning lama** yang `cityId`-nya di-set otomatis dari reverse-geocode sebelum fix Maluku diterapkan, terutama untuk provinsi yang nama kabupatennya mengandung nama provinsi sebagai substring (Maluku, Maluku Utara, Kalimantan/Sulawesi/Sumatera/Papua/Nusa Tenggara + arah mata angin) — rekomendasi ini masih menggantung dari sesi sebelumnya.
3. **Rate-limit endpoint `/wilayah/search`** di sisi backend — saat ini cuma diproteksi debounce 500ms di frontend (per user), belum ada pembatasan agregat kalau banyak user search bersamaan, padahal kebijakan fair-use Nominatim maks 1 req/detik total (bukan per user). Cache Redis 1 hari sudah membantu untuk query yang berulang, tapi query unik pertama kali tetap langsung ke Nominatim tanpa guard tambahan.
4. **Baseline migration history Prisma** — masih menggantung dari sesi-sesi sebelumnya, independen dari semua isu di atas.
