# Fitur Paket — Ringkasan & Peta Perubahan

Status: **rencana, belum diimplementasi**.
Sumber kebutuhan: `DB.xlsx` (sheet 1, blok kolom "Proyek" vs "Paket") + diskusi.

## Masalah yang diselesaikan

Saat ini 1 baris `Planning` = 1 proyek, dan proyek itu langsung punya banyak `Alokasi`
(1 alokasi = 1 RO + 1 tahun + 1 status). Tidak ada level di antara "proyek" dan
"alokasi per RO/tahun".

Kebutuhan baru: 1 proyek bisa punya **banyak Paket** (mis. Proyek A → Paket I, Paket II,
Paket Supervisi), dan hal-hal yang sekarang menempel di Planning (RO, jenis paket,
masa pelaksanaan, lokasi, dana) sebenarnya menempel di **level paket**, bukan proyek.

## Struktur baru (ringkas)

```
Planning (Proyek)                  ← tetap ada, sebagian field pindah ke Paket
 └─ Paket (BARU)                   ← 1 proyek : banyak paket
     ├─ Komponen (BARU, master, anak dari RO)
     ├─ Alokasi                    ← pindah: dulu anak Planning, sekarang anak Paket
     │   └─ LokasiAlokasi          ← tidak berubah strukturnya, cuma ikut pindah induk
     ├─ Prioritas                  ← pindah: dulu anak Planning, sekarang anak Paket
     └─ score (BARU, nullable)     ← untuk ranking, algoritma menyusul
```

Detail lengkap & alasan tiap keputusan ada di:

- [`01-database.md`](./01-database.md) — perubahan schema Prisma + strategi migrasi data lama
- [`02-backend.md`](./02-backend.md) — module/DTO/service/endpoint yang berubah & baru
- [`03-ui.md`](./03-ui.md) — komponen frontend yang berubah & baru

## Pemetaan kolom `DB.xlsx` → tempatnya nanti

Kolom yang cuma terisi di baris pertama tiap proyek = level **Proyek**. Kolom yang
terisi di setiap baris = level **Paket**.

| Kolom Excel | Level | Ke mana |
| --- | --- | --- |
| KodeProyek | Proyek | `Planning.kodeProyek` (BARU) |
| Nama Proyek | Proyek | `Planning.projectName` (sudah ada) |
| KdBalai / Balai | Proyek | `Planning.balaiId` (sudah ada) |
| Kewenangan | Proyek | `Planning.kewenangan` (sudah ada) |
| Pola_Rencana (sebelum studi layak) | Proyek | `Planning.polaRencana` (BARU — beda konsep dari `sesuaiPolaSDA` yang sudah ada, lihat catatan di 01-database.md) |
| StudiLayak / DED / LARAP (tahun) | Proyek | pakai mekanisme `KriteriaDokumen` yang **sudah ada** (jenis="Studi Kelayakan"/"DED"/"LARAP" + tahun) — tidak perlu kolom baru |
| ButuhTanah | Proyek | `Planning.kebutuhanTanah` (sudah ada, tinggal dibalik logikanya) |
| Sumber Usulan Proyek | Proyek | `Planning.sumberUsulanProyek` + `sumberUsulanLainnya` (BARU) |
| Keterangan | Proyek | `Planning.catatan` (sudah ada) |
| KodePaket | Paket | `Paket.kodePaket` (BARU) |
| KdKegiatan / KdKRO / kdRO / namaRO | Paket | tidak disimpan dobel — didapat lewat `Paket.roId` → relasi `RO.kro.kegiatan.program` yang sudah ada |
| KdKomponen / NmKomponen | Paket | master `Komponen` (BARU) + `Paket.komponenId` |
| NamaPaket | Paket | `Paket.name` (BARU) |
| Jenis Paket (F/NF) | Paket | `Paket.jenis` enum `JenisPaket` (BARU) |
| MasaLaksana | Paket | `Paket.masaPelaksanaan` (**pindah** dari `Planning.masaPelaksanaan`) |
| VolOutput/OutputSatuan/VolOutcome/OutcomeSatuan | Paket→Alokasi | tetap di `Alokasi.outputTarget/outputUnit/outcomeTarget/outcomeUnit` (sudah ada, tetap per tahun) |
| KotaKabupaten / kab-kota / kecamatan / Long / Lat | Paket | tidak ditambah kolom baru — tetap pakai `LokasiAlokasi` yang sudah ada (sekarang anak dari Alokasi→Paket) |
| DokLing | Paket | `Paket.dokLingStatus` (BARU, string bebas — nilai di excel "0"/"Sesuai" belum jelas jadi tidak dipaksakan ke enum `StatusDokumen`) |
| Catatan Pembina / Catatan SSPSDA | Paket | `Paket.catatanPembina` / `Paket.catatanSspsda` (BARU) |
| PN, PP, KP, PKPN, SP, ISP+Satuan, SK, ISK+Satuan, IRO+Satuan | Paket | field indikator baru di `Paket` (BARU, lihat 01-database.md — makna pastinya perlu dikonfirmasi) |
| Tematik RENJA | Paket | `Paket.tematikRenja` (BARU) |
| FKB / FKW / MPA | Paket | `Paket.fkb` / `fkw` / `mpa` boolean (BARU) |
| KodeWS / NamaWilayahSungai | Paket | `Paket.wilayahSungaiId` (**pindah** dari `Planning.wilayahSungaiId`) |
| SumberDana_RM/RMP/PLN/SBSN/KPBU/All | Paket→Alokasi | tetap di `Alokasi.rm/rmp/pln/sbsn/kpbu/total` (sudah ada, tetap per tahun) |
| *(tidak ada di excel)* | Paket | `Paket.score` (BARU, nullable — untuk ranking prioritas, algoritma menyusul) |

## Keputusan terbuka (perlu dikonfirmasi sebelum/selama implementasi)

1. **Algoritma score** — belum ada, sengaja ditaruh sebagai kolom nullable dulu. Perlu sesi terpisah untuk menentukan formula & input-nya.
2. **Makna pasti PN/PP/KP/PKPN/SP/SK/IRO** (kemungkinan: Prioritas Nasional, Program Prioritas, Kegiatan Prioritas, dst. — istilah RKP/Renja) — apakah ini cuma teks bebas, atau harus jadi kode yang merujuk ke master data resmi (mis. daftar Prioritas Nasional dari Bappenas)? Rencana ini menaruhnya sebagai teks bebas dulu (paling aman/lazy), gampang diubah jadi FK master kalau ternyata perlu.
3. **Field `Prioritas` yang sudah ada** (`proyekPrioritas`, `proyekRPIW`, `kegiatanBaru`, dst., checkbox per tahun) — apakah ini representasi lama dari PN/PP/KP di atas dan sebaiknya digabung, atau memang dua hal berbeda yang tetap dipakai berdampingan? Rencana ini **membiarkan keduanya terpisah** (tidak menghapus `Prioritas` lama), supaya tidak ada data/fitur existing yang hilang tanpa konfirmasi.
4. **`Planning.polaRencana` (baru) vs `Planning.sesuaiPolaSDA` (sudah ada)** — kelihatannya dua konsep berbeda (satu "pola rencana sebelum studi layak" semacam kategori dokumen, satu lagi "sesuai Pola SDA atau tidak"), tapi mirip secara penamaan. Perlu konfirmasi apakah memang dua field, atau `sesuaiPolaSDA` yang dimaksud.
5. **`KodeProyek` / `KodePaket`** — di excel sudah berupa kode jadi (mis. `PR20262000001`, `PK000017693CBR001001`). Apakah pola generate-nya perlu ditiru persis oleh backend, atau untuk sekarang cukup field teks yang diisi manual/dari import? Rencana ini: field opsional dulu, aturan generate menyusul (lihat `02-backend.md`).
6. **Kolom lokasi flat di level Paket** (`KotaKabupaten`, `kab/kota`, `kecamatan`, `Long`, `Lat`) — di excel ini kelihatan seperti gaya penulisan flat khas Excel, bukan berarti butuh kolom baru di `Paket`. Rencana ini menganggap itu representasi ringkas dari `LokasiAlokasi` yang sudah ada. Perlu dicek ulang saat proses import data nyata — kalau ternyata perlu titik lokasi ringkas per Paket (di luar lokasi per-alokasi), baru ditambahkan.

Selama keputusan-keputusan di atas belum difinalkan, field terkait di schema baru **sengaja dibuat nullable/opsional** supaya tidak memblokir pengerjaan bagian lain.
