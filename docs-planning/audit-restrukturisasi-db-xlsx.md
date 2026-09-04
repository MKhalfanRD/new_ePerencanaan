# Audit: Apa yang Masih Terpakai dari Struktur Lama vs `DB.xlsx`

Instruksi: `DB.xlsx` sekarang **satu-satunya sumber kebenaran struktur data**. Semua struktur lama project ini dicek satu-satu: **PAKAI** (cocok/dibutuhkan), **BUANG** (tidak ada dasarnya di `DB.xlsx`), atau **PERLU KEPUTUSAN** (ada tapi bentuknya beda/meragukan).

Ini **dokumen analisis saja** — belum ada kode yang diubah/dihapus. Eksekusi menunggu konfirmasi Anda di bagian "Keputusan yang Diperlukan" (§4), karena beberapa temuan sifatnya destruktif (hapus model/tabel).

## 0. Koreksi: klaim "bug pergeseran kolom" di versi audit sebelumnya SALAH

Analisis pertama saya (pakai parser XML manual saya sendiri) menyimpulkan baris 4-5 bergeser 1 kolom penuh dari `KodePaket` (kolom 13) dan seterusnya. **Itu salah** — pas divalidasi ulang pakai library `xlsx` asli (dipakai langsung di `import.service.ts`), kolom 13-47 (`KodePaket` sampai `MPA`) semuanya align dengan benar di baris 4-5. Kesalahannya ada di script diagnostik saya, bukan di file-nya.

**Temuan yang benar** (dicek ulang langsung, per kolom): cuma rentang `KodeWS` (48) sampai `SumberDanaAll` (59) yang datanya berantakan, dan polanya **tidak konsisten** antar baris (bukan geser rata 1 kolom):

- `KodeWS`/`NamaWilayahSungai`: nama wilayah sungai ("Alas-Singkil") kadang nyasar ke kolom `KodeWS`, kolom `NamaWilayahSungai`-nya kosong. Parser sekarang menangani ini secara sempit & aman: kalau `KodeWS` isinya tidak match pola kode asli (`01.09.A2`), dianggap itu sebenarnya nama wilayah sungai.
- `Long`/`Lat`: kemungkinan tertukar (nilai yang masuk akal sebagai latitude Aceh ada di kolom `Long`, nilai longitude-nya ada di kolom lain) — **tidak** saya coba tebak-perbaiki otomatis, terlalu berisiko salah pada file lain. Diimpor apa adanya, perlu dicek manual usai import.
- `SumberDanaAll`: di baris 4-5 isinya malah kode wilayah sungai, bukan angka. Parser tidak pernah mempercayai kolom ini mentah-mentah — total selalu dihitung ulang dari `RM+RMP+PLN+SBSN+KPBU`, jadi baris ini tetap dapat total yang benar (2,5 M) walau kolom aslinya rusak.

**Kesimpulan**: data kotor di area dana/lokasi ini nyata, tapi tidak bisa (dan tidak aman) diperbaiki otomatis secara umum — parser dibuat defensif (hitung ulang total, fallback nama wilayah sungai yang sempit & berbukti) daripada menebak pola pergeseran yang ternyata tidak konsisten.

## 1. Peta kolom `DB.xlsx` (59 kolom, dikonfirmasi ulang langsung dari file)

**Blok Proyek** (kolom 1-12, cuma terisi di baris pertama tiap grup):
`KodeProyek, Nama Proyek, KdBalai, Balai, Kewenangan, Pola_Rencana (sebelum studi layak), StudiLayak, DED, LARAP, ButuhTanah, Sumber Usulan Proyek, Keterangan`

**Blok Paket** (kolom 13-59, terisi di setiap baris):
`KodePaket, KdKegiatan, KdKRO, namaRO. Nomenklatur, kdRO, namaRO, KdKomponen, NmKomponen, NamaPaket, Jenis Paket (F/NF), MasaLaksana, VolOutput, OutputSatuan, VolOutcome, OutcomeSatuan, KotaKabupaten, DokLing, Catatan Pembina, Catatan SSPSDA, PN, PP, KP, PKPN, SP, ISP, Satuan ISP, SK, ISK, Satuan ISK, IRO, Satuan IRO, Tematik RENJA, FKB, FKW, MPA, KodeWS, NamaWilayahSungai, kab/kota, kecamatan, Long, Lat, SumberDana_RM, SumberDana_RMP, SumberDana_PLN, SumberDana_SBSN, SumberDana_KPBU, SumberDanaAll`

**Tidak ada kolom "Tahun"/"Periode" maupun "Status Rencana/Realisasi" di mana pun.** Ini penting — lihat §3.1.

## 2. PAKAI — cocok, tidak perlu diubah

| Struktur lama | Bukti kecocokan di `DB.xlsx` |
| --- | --- |
| `Balai` (id/name/code) | `KdBalai`, `Balai` |
| `Program > Kegiatan > KRO > RO` | `KdKegiatan`, `KdKRO`, `kdRO`, `namaRO` |
| `Komponen` (anak RO) — baru saya tambahkan | `KdKomponen`, `NmKomponen` |
| `WilayahSungai`, sekarang di level Paket | `KodeWS`, `NamaWilayahSungai` |
| `PrioritasNasional>ProgramPrioritas>KegiatanPrioritas`, `Pkpn`, `TematikRenja`, `SasaranProgram>ISP`, `SasaranKegiatan>ISK`, `IndikatorRO` (baru) | `PN/PP/KP`, `PKPN`, `Tematik RENJA`, `SP/ISP`, `SK/ISK`, `IRO` |
| `Paket.fkb/fkw/mpa` (boolean) | `FKB`, `FKW`, `MPA` |
| `Paket.jenis` (FISIK/NON_FISIK) | `Jenis Paket (F/NF)` |
| `Paket.masaPelaksanaan` | `MasaLaksana` |
| `Paket.dokLingStatus` (teks bebas, bukan enum) | `DokLing` |
| `Paket.catatanPembina`, `catatanSspsda` | `Catatan Pembina`, `Catatan SSPSDA` |
| `Planning.kodeProyek`, `Paket.kodePaket` | `KodeProyek`, `KodePaket` |
| `Planning.sumberUsulanProyek` + `sumberUsulanLainnya` | `Sumber Usulan Proyek` |
| `Planning.kebutuhanTanah` | `ButuhTanah` |
| `Planning.polaRencana` | `Pola_Rencana (sebelum studi layak)` |
| `Planning.catatan` | `Keterangan` |
| `Planning.kewenangan` | `Kewenangan` |
| Auth/User/Role, JWT, guard | Tidak ada di `DB.xlsx` (memang bukan cakupannya) — **tetap dipakai**, ini infrastruktur aplikasi, bukan data domain |
| `Planning.status` disederhanakan DRAFT/APPROVED | `DB.xlsx` tidak punya kolom status sama sekali — jadi tidak bertentangan, tapi juga tidak dikonfirmasi butuh 2 state itu. Dianggap tetap valid sebagai keputusan aplikasi (bukan data export) |
| `score` (nullable, di Paket) | Sesuai arahan Anda sendiri — sengaja belum ada di excel |

Semua yang barusan saya bangun untuk fitur Paket (skema, master baru, seed script) **sudah dibangun berdasarkan `DB.xlsx`/`referensi 1.xlsx`**, jadi otomatis cocok. Yang perlu diaudit justru struktur **lama** yang sudah ada sebelum saya sentuh.

## 3. PERLU KEPUTUSAN — ada, tapi bentuknya meragukan/beda

### 3.1 🔴 Alokasi per-tahun (Rencana/Realisasi) — TIDAK ADA di `DB.xlsx`

Ini temuan paling besar. Model `Alokasi` sekarang: 1 baris = 1 RO(via Paket) + 1 **tahun** + 1 **status** (RENCANA/REALISASI), field `rm/rmp/pln/sbsn/kpbu/total/outputTarget/outcomeTarget`.

`DB.xlsx` cuma punya **satu set angka per Paket** (`SumberDana_RM...SumberDanaAll`, `VolOutput`, `VolOutcome`) — **tidak ada kolom tahun, tidak ada kolom status Rencana/Realisasi**. Kalau `DB.xlsx` benar-benar mau dijadikan bentuk final, artinya:

- **Opsi A**: `Alokasi` sebagai entitas terpisah (per tahun/status) **dibuang**, field dana & volume pindah jadi kolom langsung di `Paket` (persis 1:1 dengan excel). Konsekuensi: hilang kemampuan bandingkan Rencana vs Realisasi per tahun, hilang riwayat multi-tahun per paket (`HistoriAlokasi` ikut tidak relevan).
- **Opsi B**: `DB.xlsx` cuma **snapshot satu tahun anggaran** (export "tahun berjalan" saja), dan tracking multi-tahun/Rencana-Realisasi tetap perlu ada di aplikasi meski tidak kelihatan di file ini. `Alokasi` **tetap dipakai apa adanya**.

Saya **tidak menghapus ini sepihak** — dampaknya besar (form, tampilan detail, export, semua bergantung pada struktur per-tahun ini) dan pemerintah pada umumnya memang menganggarkan multi-tahun, jadi opsi B masuk akal juga. **Butuh konfirmasi Anda** (lihat §4).

### 3.2 🔴 `Periode` (rentang tahun anggaran aktif) — tidak ada di `DB.xlsx`

`Planning.periodeId` wajib diisi saat ini (dipakai di dashboard, list, form). Tidak ada kolom apa pun di `DB.xlsx` yang merepresentasikan ini. Kalau alokasi per-tahun juga dibuang (opsi A di atas), `Periode` sebagai pengelompok jadi makin tidak relevan — tahun sudah cukup implisit dari `StudiLayak/DED/LARAP` (di Proyek) yang memang berupa tahun bebas, bukan rentang periode.

**Rekomendasi kalau opsi A dipilih**: `Periode` dibuang total (model, master tab, field wajib di form). **Kalau opsi B dipilih**: `Periode` tetap perlu (untuk mengelompokkan `Alokasi.tahun`).

### 3.3 🟡 `KriteriaDokumen` (generic jenis+status+tahun) — cocok sebagian, tidak persis

Dipakai sekarang untuk "Studi Kelayakan"/"DED"/"LARAP"/"Dokumen Lingkungan"/"Persetujuan Multi Year Contract" dengan `status: TIDAK_PERLU/BELUM_ADA/SUDAH_ADA` + `tahun` opsional.

`DB.xlsx`: `StudiLayak`, `DED`, `LARAP` di Proyek **cuma angka tahun** (`2020`, `2022`, `2025`) — **tidak ada field status terpisah**. `DokLing` di Paket nilainya `"0"` atau `"Sesuai"` — bukan salah satu dari 3 enum status yang ada sekarang.

**Rekomendasi**: `Planning.tahunStudiLayak` / `tahunDed` / `tahunLarap` jadi 3 kolom `Int?` langsung di `Planning` (bukan lewat `KriteriaDokumen` generic), match 1:1 ke excel. `DokLing` di `Paket` **sudah benar** (saya sudah jadikan `String?` bebas, bukan enum — tidak perlu diubah). "Persetujuan Multi Year Contract" di form (`KRITERIA_JENIS` frontend) — **tidak ada** di `DB.xlsx`, kandidat buang.

### 3.4 🟡 Wilayah administratif cascading (Province>Regency>District>Village + `LokasiAlokasi`) — kemungkinan kelewat detail

`DB.xlsx` di level Paket cuma punya: `KotaKabupaten` (1 kolom teks bebas), lalu terpisah `kab/kota` + `kecamatan` (2 kolom teks bebas lagi — ya, kelihatan redundan dengan `KotaKabupaten`, ini juga saya tandai di `00-overview.md` #6 sebelumnya), plus `Long`/`Lat`. **Tidak ada level provinsi atau desa/kelurahan sama sekali**, dan tidak ada `id` kode wilayah — semua teks bebas.

Struktur lama (`WilayahProvince/Regency/District/Village` + `LokasiAlokasi` dengan `provinceId/cityId/districtId/villageId` + reverse-geocode otomatis) **lebih detail dari yang diminta `DB.xlsx`** (4 level administratif + kode resmi Kemendagri, vs cuma 2 level teks bebas di excel).

**Rekomendasi**: **infrastruktur peta & reverse-geocode tetap dipakai** (fitur baik, UX bagus, dan tidak bertentangan — cuma dipetakan ke lebih sedikit field saat disimpan/di-export: `KotaKabupaten`/`kab/kota` bisa diisi otomatis dari hasil klik peta, cukup simpan **nama**-nya sebagai teks, tidak perlu simpan `provinceId/districtId/villageId` terpisah kalau memang excel tidak butuh). Tapi ini juga perlu dikonfirmasi — kalau Anda mau tetap simpan detail lengkap (province/district/village id) untuk kebutuhan internal lain (laporan, filter wilayah), berarti field itu dipertahankan sebagai tambahan, bukan dibuang.

### 3.5 🟡 `namaRO. Nomenklatur` (kolom 16) — tidak jelas fungsinya

Ada di antara `kdRO` punya nama sendiri "namaRO. Nomenklatur" dan kolom 18 juga "namaRO" — dua kolom nama RO yang mirip. Kemungkinan kolom 16 itu placeholder/typo di excel (nama kolom aneh, isinya sepertinya sama dengan RO name biasa). Tidak actionable sampai dikonfirmasi — untuk sekarang diabaikan, dianggap duplikat dari kolom 18 (`namaRO`) yang sudah match ke `RO.name` yang ada.

## 4. BUANG — tidak ada dasarnya sama sekali di `DB.xlsx`

Model-model ini murni warisan sebelum restrukturisasi, nol jejak di `DB.xlsx`:

| Struktur | Kenapa dibuang |
| --- | --- |
| `MajorProject` + `PlanningMajorProject` (many-to-many ke Planning) | Tidak ada kolom "Major Project" di `DB.xlsx` sama sekali. (Catatan: PKPN yang baru sedikit mirip konsep "proyek strategis nasional" tapi sudah dicover terpisah lewat `Pkpn`.) |
| `TindakLanjut` + `PlanningTindakLanjut` (many-to-many ke Planning) | Tidak ada kolom terkait. `Sumber Usulan Proyek` sekilas mirip (salah satu pilihannya "tindak lanjut renaksi/renduk/masterplan sektor") tapi itu sudah sepenuhnya dicover oleh `sumberUsulanProyek` enum yang baru — bukan tindak lanjut terpisah. |
| `Prioritas` (boolean lama: `proyekPrioritas`, `proyekRPIW`, `kegiatanBaru`, `kegiatanWajib`, `proyekKonregFKS`, `proyekMusrengbangnas`) | Sudah sepenuhnya digantikan konsep PN/PP/KP/PKPN yang baru (dari `referensi 1.xlsx`) — 6 boolean lama ini tidak match nama/bentuk apa pun di `DB.xlsx`. |
| `PlanningReview` | Sudah dihapus sebelumnya (instruksi status disederhanakan) — konsisten, tidak ada di `DB.xlsx`. |
| Halaman Review, endpoint submit/review | Sudah dihapus sebelumnya — konsisten. |
| `import.service.ts` (parser RKA-K/L sheet per-RO/tahun `SHEETS_TO_PROCESS = ['7691'...'7694']`) | Format sumbernya sama sekali beda dari `DB.xlsx` (flat 2-level Proyek/Paket). Bukan dibuang total, tapi **harus ditulis ulang** mengikuti format `DB.xlsx`, bukan ditambal seperti kemarin. |

**Frontend yang ikut kena kalau model di atas dibuang**: `components/master/major-project-tab.tsx`, `tindak-lanjut-tab.tsx` (dua tab Master Data jadi tidak berlaku), field "Prioritas Nasional/Major Project" di `planning-form-dialog.tsx` & `planning-detail-sheet.tsx`, `MajorProjectDto`/`PrioritasDto`(lama)/`tindakLanjutIds` di `create-planning.dto.ts`.

## 5. Ringkasan keputusan yang diperlukan sebelum eksekusi

1. **Alokasi per-tahun (§3.1)** — dibuang jadi field flat di Paket (ikut persis `DB.xlsx`), atau dipertahankan (anggap `DB.xlsx` cuma snapshot 1 tahun)? Ini menentukan jawaban §3.2 (`Periode`) juga.
2. **`KriteriaDokumen` untuk StudiLayak/DED/LARAP** (§3.3) — ganti jadi 3 kolom tahun langsung di `Planning`, setuju?
3. **Wilayah administratif** (§3.4) — pertahankan detail province/district/village id untuk kebutuhan internal, atau sederhanakan ikut `DB.xlsx` (cuma teks `kab/kota`+`kecamatan` tanpa id)?
4. **Buang `MajorProject`/`TindakLanjut`/`Prioritas` (boolean lama)** (§4) — konfirmasi hapus, atau ada kebutuhan internal (di luar excel) yang masih pakai ini sehingga harus dipertahankan?
5. **Import Excel** — tulis ulang total mengikuti format `DB.xlsx` (2-level Proyek/Paket, bukan format RKA-K/L lama)?

Begitu poin 1-4 dijawab, saya lanjut eksekusi: migrasi schema (drop/rename kolom & tabel sesuai keputusan), bersihkan DTO/service/frontend yang menyentuh struktur yang dibuang, baru masuk ke pembangunan form Paket lengkap & parser import baru.
