# Rencana Perubahan Database — Fitur Paket

File: `apps/backend/prisma/schema.prisma`. Lihat [`00-overview.md`](./00-overview.md) untuk pemetaan kolom Excel dan keputusan terbuka.

## 1. Model & enum BARU

### `Paket`

```prisma
enum JenisPaket {
  FISIK
  NON_FISIK
}

enum SumberUsulanProyek {
  PEMERINTAH_DAERAH
  KEMENTERIAN_LEMBAGA
  MASYARAKAT
  TINDAK_LANJUT_RENAKSI
  LAINNYA
}

model Paket {
  id         String   @id @default(cuid())
  planningId String
  planning   Planning @relation(fields: [planningId], references: [id], onDelete: Cascade)

  kodePaket String? @unique @db.VarChar(50)
  name      String  @db.VarChar(255) // NamaPaket

  roId String @db.VarChar(20)
  ro   RO     @relation(fields: [roId], references: [id])

  komponenId String?
  komponen   Komponen? @relation(fields: [komponenId], references: [id])

  jenis           JenisPaket
  masaPelaksanaan MasaPelaksanaan // pindah dari Planning

  wilayahSungaiId String?
  wilayahSungai   WilayahSungai? @relation(fields: [wilayahSungaiId], references: [id])

  dokLingStatus String? @db.VarChar(50)

  catatanPembina String? @db.Text
  catatanSspsda  String? @db.Text

  // Indikator RENJA — makna pasti perlu dikonfirmasi (lihat overview #2), disimpan bebas dulu
  pn         String? @db.VarChar(255)
  pp         String? @db.VarChar(255)
  kp         String? @db.VarChar(255)
  pkpn       String? @db.VarChar(255)
  sp         String? @db.VarChar(255)
  isp        String? @db.VarChar(255)
  satuanIsp  String? @db.VarChar(50)
  sk         String? @db.VarChar(255)
  isk        String? @db.VarChar(255)
  satuanIsk  String? @db.VarChar(50)
  iro        String? @db.VarChar(255)
  satuanIro  String? @db.VarChar(50)
  tematikRenja String? @db.VarChar(255)

  fkb Boolean @default(false)
  fkw Boolean @default(false)
  mpa Boolean @default(false)

  score Decimal? @db.Decimal(10, 2) // untuk ranking prioritas — algoritma menyusul

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  alokasi   Alokasi[]
  prioritas Prioritas[]

  @@index([planningId])
  @@index([roId])
  @@map("paket")
}
```

### `Komponen` (master, anak dari `RO`)

```prisma
model Komponen {
  id    String @id @default(cuid())
  roId  String @db.VarChar(20)
  ro    RO     @relation(fields: [roId], references: [id])
  code  String @db.VarChar(10)
  name  String @db.VarChar(255)

  paket Paket[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([roId])
  @@map("komponen")
}
```

Pola ini menyalin persis pola `RO` (anak dari `KRO`) yang sudah ada — konsisten dengan hierarki nomenklatur `Program → Kegiatan → KRO → RO → Komponen` yang sekarang jadi 5 level.

## 2. Perubahan pada model yang SUDAH ADA

### `Planning`

Field yang **dihapus** (pindah ke `Paket`):

- `masaPelaksanaan`
- `wilayahSungaiId` (+ relasi `wilayahSungai`)

Field **baru**:

```prisma
kodeProyek           String?             @unique @db.VarChar(50)
polaRencana          String?             @db.VarChar(100) // "Pola_Rencana (sebelum studi layak)" — lihat overview #4
sumberUsulanProyek   SumberUsulanProyek?
sumberUsulanLainnya  String?             @db.Text // dipakai kalau sumberUsulanProyek = LAINNYA
```

Relasi yang berubah tipenya: `alokasi Alokasi[]` dan `prioritas Prioritas[]` **dihapus** dari `Planning` (pindah jadi relasi `Paket`). `Planning` dapat relasi baru `paket Paket[]`.

Tidak berubah: `KriteriaDokumen`, `PlanningMajorProject`, `PlanningTindakLanjut`, `PlanningReview`, semua field kesesuaian (`sesuaiRTRW`, `nomorPerdaRTRW`, `sesuaiPolaSDA`, `nomorKepmenPUPR`, `sesuaiMasterplan`), `kebutuhanTanah`, `status`, dll.

### `Alokasi`

```diff
model Alokasi {
   id         String   @id @default(cuid())
-  planningId String
-  planning   Planning @relation(fields: [planningId], references: [id], onDelete: Cascade)
+  paketId    String
+  paket      Paket    @relation(fields: [paketId], references: [id], onDelete: Cascade)

-  roId String @db.VarChar(20)
-  ro   RO     @relation(fields: [roId], references: [id])
-
   tahun  Int            @db.SmallInt
   status AllokasiStatus
   ...
-  @@unique([planningId, roId, tahun, status])
+  @@unique([paketId, tahun, status])
```

`roId` dihapus dari `Alokasi` karena RO sekarang ditentukan di level `Paket` (satu paket = satu RO). Kalau nanti ternyata satu paket perlu lebih dari satu RO per tahun, ini titik yang paling gampang dibalik (tinggal kembalikan `roId` ke `Alokasi`) — tidak perlu dilakukan sekarang tanpa bukti kebutuhannya (YAGNI).

`LokasiAlokasi` dan `HistoriAlokasi`: **tidak berubah sama sekali**, tetap anak dari `Alokasi` seperti sekarang — otomatis ikut pindah induk karena mengikuti `Alokasi`.

### `Prioritas`

```diff
model Prioritas {
   id         String   @id @default(cuid())
-  planningId String
-  planning   Planning @relation(fields: [planningId], references: [id], onDelete: Cascade)
+  paketId    String
+  paket      Paket    @relation(fields: [paketId], references: [id], onDelete: Cascade)

   tahun ...
-  @@unique([planningId, tahun])
+  @@unique([paketId, tahun])
```

Isi field-field boolean-nya (`proyekPrioritas`, dst.) tidak berubah — lihat keputusan terbuka #3 di overview soal potensi tumpang tindih dengan PN/PP/KP.

### `RO`

Tambah relasi balik:

```diff
model RO {
   ...
   indikatorRO IndikatorRO[]
-  alokasi     Alokasi[]
+  paket       Paket[]
+  komponen    Komponen[]
```

(`alokasi Alokasi[]` dihapus dari `RO` karena `Alokasi` tidak lagi FK langsung ke `RO`.)

### `WilayahSungai`

```diff
model WilayahSungai {
   id   String @id @default(cuid())
   name String @db.VarChar(255)

-  plannings Planning[]
+  paket     Paket[]
```

## 3. Migrasi data lama

Data existing: setiap `Planning` sudah punya 0..n `Alokasi` (masing-masing dengan `roId` sendiri) dan 0..n `Prioritas` per tahun. Tidak ada konsep "paket" — jadi migrasi harus **membuat Paket dari data yang ada**, bukan cuma rename kolom.

Strategi (dijalankan sebagai migration script terpisah, dieksekusi manual oleh user seperti migrasi lain di proyek ini — lihat `prisma/scripts/`):

1. Untuk setiap `Planning`, ambil semua `roId` unik dari `Alokasi` miliknya.
2. Untuk tiap `(planningId, roId)` unik itu, buat 1 `Paket` baru:
   - `name` = `projectName` planning (tidak ada nama paket asli di data lama, jadi dipakai fallback ini — bisa diedit user setelahnya)
   - `roId` = roId tersebut
   - `masaPelaksanaan` = disalin dari `Planning.masaPelaksanaan` lama
   - `wilayahSungaiId` = disalin dari `Planning.wilayahSungaiId` lama
   - `jenis` = default `FISIK` (tidak ada data lama untuk ini — perlu keputusan default, tandai jelas di changelog migrasi supaya user tahu perlu direview manual)
3. Pindahkan (`UPDATE`) semua `Alokasi` yang `(planningId, roId)`-nya cocok ke `paketId` paket baru tsb., lalu hapus kolom `planningId`/`roId` dari `Alokasi`.
4. Untuk `Prioritas`: karena dulu 1 planning cuma punya 1 baris `Prioritas` per tahun (tidak per RO), duplikasi baris itu ke **setiap** Paket baru hasil langkah 2 milik planning yang sama, dengan `tahun` yang sama.
5. Setelah dipastikan data pindah lengkap (hitung jumlah baris `Alokasi`/`Prioritas` sebelum-sesudah harus sama/proporsional), baru drop kolom lama (`Planning.masaPelaksanaan`, `Planning.wilayahSungaiId`).

Ini **migrasi berisiko** (mengubah kepemilikan baris finansial) — jalankan di database staging/backup dulu, verifikasi total `rm+rmp+pln+sbsn+kpbu` per planning sebelum & sesudah migrasi sama persis, baru jalankan di production. Baseline migration history Prisma yang masih menggantung dari sesi sebelumnya sebaiknya diselesaikan **sebelum** migrasi ini supaya riwayat migrasi tetap bersih.

## 4. Yang TIDAK berubah

- Semua model auth/user/role, master wilayah administratif (`WilayahProvince/Regency/District/Village`), `Balai`, `Periode`, `MajorProject`, `TindakLanjut`, `PlanningReview`, `KriteriaDokumen`.
- Struktur `LokasiAlokasi` dan `HistoriAlokasi` (cuma pindah induk transitif lewat `Alokasi`).
- Enum `PlanningStatus`, `Kewenangan`, `StatusDokumen`, `AllokasiStatus`, `TipeKoordinat`, `MasaPelaksanaan` (dipakai ulang di `Paket`).
