# Rekonsiliasi Data Master vs `referensi 1.xlsx`

File: `D:\KERJAA\new_ePerencanaan\referensi 1.xlsx`, 4 sheet: **RSPP**, **PNPPKP**, **SPSK**, **Tagging RENJA**.
Dibandingkan terhadap: `apps/backend/prisma/scripts/kro-ro-master.json` (sumber seed nomenklatur RO yang dipakai project ini) dan field-field Paket yang sudah dirancang di `01-database.md`.

## 1. Sheet "RSPP" — Program > Kegiatan > KRO > RO > Satuan > Komponen

Ini katalog nomenklatur resmi. Temuan setelah dibandingkan dengan `kro-ro-master.json`:

### 1a. Cakupan Kegiatan — kurang banyak

`kro-ro-master.json` cuma punya **4 dari 11 Kegiatan** yang ada di RSPP:

| Kegiatan (RSPP) | Ada di `kro-ro-master.json`? |
| --- | --- |
| 7686 Pengendalian Lumpur Sidoarjo | ❌ Tidak ada |
| 7687 Layanan Kesekretariatan DSDAN | ❌ Tidak ada |
| 7688 Perencanaan, Pemrograman, Penganggaran, dan Evaluasi | ❌ Tidak ada |
| 7689 Kepatuhan ... | ❌ Tidak ada |
| 7690 Layanan ... | ❌ Tidak ada |
| 7691 Pengembangan dan Rehabilitasi Jaringan Irigasi ... | ✅ Ada (sebagian, lihat 1b) |
| 7692 Pengendalian Banjir, Lahar, ... | ✅ Ada (sebagian) |
| 7693 Pengembangan Bendungan, Danau, ... | ✅ Ada (sebagian) |
| 7694 Pengembangan Jaringan Air Tanah dan Air Baku | ✅ Ada (sebagian) |
| 7695 Operasi ... | ❌ Tidak ada |
| 7755 Dukungan ... | ❌ Tidak ada |

`import.service.ts` juga cuma memproses sheet Excel RKA-K/L untuk 4 kegiatan yang sama (`SHEETS_TO_PROCESS = ['7691','7692','7693','7694']`) — konsisten dengan gap ini, bukan bug terpisah.

### 1b. Bahkan di 4 Kegiatan yang "ada", KRO-nya cuma sebagian

Untuk tiap satu dari 4 kegiatan itu, RSPP punya 4-6 KRO, tapi `kro-ro-master.json` cuma punya **2 KRO** (kode `RBG`/`RBS` — kategori "Prasarana"/pembangunan fisik saja). KRO administratif/dukungan (`BAH`, `CBG`/`CBH`, `CBR`, `CBS`) sama sekali tidak ada:

| Kegiatan | KRO di RSPP | KRO di `kro-ro-master.json` | KRO yang hilang |
| --- | --- | --- | --- |
| 7691 | BAH, CBG, CBR, CBS, RBG, RBS | RBG, RBS | BAH, CBG, CBR, CBS |
| 7692 | BAH, CBH, CBR, CBS, RBH, RBS | RBH, RBS | BAH, CBH, CBR, CBS |
| 7693 | BAH, CBG, CBR, RBG | RBG | BAH, CBG, CBR |
| 7694 | BAH, CBG, CBR, CBS, RBG, RBS | RBG, RBS | BAH, CBG, CBR, CBS |

### 1c. RO: dua sumber punya isi yang beda karakter, bukan cuma "kurang lengkap"

Untuk KRO yang **sama-sama ada** di kedua sumber (RBG/RBS/RBH), RO di `kro-ro-master.json` **lebih banyak** daripada RSPP (mis. RBS di kegiatan 7691: RSPP kosong untuk kode itu di rentang RO generik, tapi `kro-ro-master.json` punya puluhan kode `RBS.501`-`RBS.732` — nama-nama seperti "Jaringan Irigasi DI Rentang (RIMP)", "Jaringan Irigasi Daerah Irigasi Cisadane"). Ini kelihatan seperti **RO riil per lokasi/proyek** (hasil import RKA-K/L sungguhan), sedangkan RSPP sheet 1 kelihatan seperti **katalog RO generik/template** (mis. cuma "001 Jaringan Irigasi Waduk", "003 ... di Sentra Produksi Lumbung Pangan").

**Kesimpulan: dua sumber ini punya tujuan berbeda, bukan salah satu yang "benar" dan satunya "salah".** `kro-ro-master.json` = RO riil yang sudah dipakai project (dari RKA-K/L), RSPP = katalog resmi/template RO. Menimpa begitu saja `kro-ro-master.json` dengan isi RSPP akan **menghapus data RO riil yang sudah dipakai planning/alokasi existing**.

Ditemukan **1 RO dengan kode sama tapi nama beda** (bukan sekadar "kurang lengkap" — ini kemungkinan salah ketik / beda periode data):

- `7694.RBS.004`: RSPP = *"Prasarana Penyediaan Air Baku di Perkotaan Pesisir Utara Jawa"*, `kro-ro-master.json` = *"Jaringan Air Baku di Perkotaan Pesisir Utara Jawa"*.

### 1d. Komponen — konsep baru, nol data existing

RSPP sheet punya level **Komponen** di bawah RO (mis. RO `7686.BAH.001` punya 3 komponen: `300 Penyusunan NSPK`, `311 Bimbingan/Pembinaan Teknis`, `319 Monitoring, Evaluasi, dan Pelaporan`). Project ini **belum punya data Komponen sama sekali** — model `Komponen` yang baru ditambahkan di `01-database.md` masih kosong. RSPP adalah kandidat sumber seed yang bagus untuk ini, TAPI cakupannya cuma untuk kegiatan yang ada Komponen-nya di sheet (tidak semua RO di RSPP punya baris Komponen — banyak yang kosong).

### Rekomendasi 1

1. **Keputusan produk, bukan teknis**: apakah `kro-ro-master.json` mau ditambah (bukan diganti) dengan 7 kegiatan yang hilang + KRO administratif (BAH/CBG/CBH/CBR/CBS) dari RSPP? Kalau ya, saya bisa buatkan script tambahan (`prisma/scripts/import-rspp-nomenklatur.ts`) yang **menambah** (upsert, bukan replace) data baru dari RSPP tanpa menyentuh RO riil yang sudah ada.
2. **Perbaiki 1 nama RO yang beda** (`7694.RBS.004`) — perlu konfirmasi nama mana yang benar sebelum diubah (dokumen resmi RSPP biasanya lebih otoritatif, tapi nama lama mungkin sudah dipakai di planning/alokasi yang sudah ada — cek dulu apakah namanya ditampilkan ke user di planning existing sebelum ganti, supaya tidak bikin bingung data historis).
3. **Import Komponen** dari RSPP sebagai seed awal `Komponen` — bisa dikerjakan sebagai bagian dari script yang sama di poin 1.

## 2. Sheet "PNPPKP" — PN > PP > KP (hierarki RPJMN)

Ini yang menjawab tuntas **keputusan terbuka #2** di `00-overview.md` ("makna pasti PN/PP/KP"). Bukan teks bebas — ini **hierarki 3 level** persis seperti Program>Kegiatan>KRO:

```
PN  02 Memantapkan Sistem Pertahanan Keamanan Negara dan Mendorong Kemandirian
    Bangsa melalui Swasembada Pangan, Energi, Air, Ekonomi Syariah, Ekonomi
    Digital, Ekonomi Hijau, dan Ekonomi Biru
 └─ PP  02.12 Swasembada Air
     ├─ KP  02.12.01 Pembangunan dan Pengelolaan Tampungan Air
     ├─ KP  02.12.02 Penyediaan Pasokan Air Berkelanjutan
     ├─ KP  02.12.03 Pengelolaan Risiko Daya Rusak Air
     └─ KP  02.12.09 Pengembangan Terpadu Pesisir Utara Jawa
```

**Perubahan dari rencana sebelumnya**: field `pn`/`pp`/`kp` di `Paket` (`01-database.md`) yang tadinya `String?` bebas, **diganti** jadi satu FK `kegiatanPrioritasId` ke model master baru `KegiatanPrioritas` (leaf-nya) — PN & PP didapat lewat relasi parent-nya, sama persis pola RO→KRO→Kegiatan→Program yang sudah ada. Lihat perubahan schema di bagian bawah dokumen ini.

## 3. Sheet "SPSK" — SP/ISP (per Program) & SK/ISK (per Kegiatan)

Ini juga hierarki nyata, bukan teks bebas, dan levelnya **menempel ke Program/Kegiatan yang sudah ada** (bukan hierarki berdiri sendiri seperti PN/PP/KP):

```
Program "Ketahanan Sumber Daya Air"
 └─ SP  "Terwujudnya pengelolaan sumber daya air berkelanjutan..."
     ├─ ISP  "Kapasitas tampungan air"
     ├─ ISP  "Rasio kapasitas air baku terpasang terhadap kebutuhan penduduk"
     └─ ... (9 ISP total untuk SP ini)

Kegiatan "7686 Pengendalian Lumpur Sidoarjo"
 └─ SK  "Meningkatnya ketahanan wilayah area yang terdampak lumpur Sidoarjo"
     ├─ ISK  "Jumlah volume luapan lumpur yang dialirkan ke Kali Porong"
     └─ ... (5 ISK total untuk SK ini)
```

Satu Program/Kegiatan bisa punya **lebih dari satu** SP/SK (mis. Program "Ketahanan Sumber Daya Air" punya 2 SP; Kegiatan 7686 punya 3 SK). Field `sp`/`isp`/`sk`/`isk` di `Paket` **diganti** jadi 2 FK: `indikatorSasaranProgramId` (→ ISP, SP didapat dari parent-nya) dan `indikatorSasaranKegiatanId` (→ ISK, SK dari parent-nya) — Paket memilih indikator spesifik yang relevan, bukan mengetik ulang teksnya.

**Field `iro`/`satuanIro`** (Indikator RO) — ternyata **tidak perlu master baru sama sekali**. Project ini sudah punya model `IndikatorRO` (nama + satuan, anak dari RO) yang belum dipakai di mana pun. Field ini diganti jadi FK `indikatorRoId` → `IndikatorRO`, otomatis terbatas ke indikator milik RO yang sama dengan RO Paket tsb.

## 4. Sheet "Tagging RENJA" — Tematik & PKPN, dua daftar flat

```
TEMATIK (4 nilai tetap)          PKPN (3 nilai, kemungkinan bertambah tiap siklus RENJA)
- Adaptasi Perubahan Iklim       - Swasembada Air
- Mitigasi Perubahan Iklim       - Rehabilitasi dan Rekonstruksi Pascabencana Sumatera
- Anggaran Infrastruktur         - Giant Sea Wall
- Pengarusutamaan Gender
```

Bukan hierarki, cuma daftar datar — tapi tetap **daftar master yang bisa berubah per tahun RENJA**, bukan nilai tetap selamanya. Dimodelkan sebagai master table kecil (pola sama seperti `MajorProject`/`TindakLanjut` yang sudah ada: `id` + `name`, dikelola dari menu Master), **bukan** hardcode enum Prisma — enum butuh migration tiap kali nilainya berubah, tabel master tidak.

`fkb`/`fkw`/`mpa`: **tidak berubah** dari rencana semula (tetap 3 boolean terpisah di `Paket`) — sheet referensi ini tidak menyinggung FKB/FKW sama sekali, jadi tidak ada bukti baru yang mengubah keputusan itu.

## 5. Perubahan pada `01-database.md` (model `Paket`)

```diff
model Paket {
   ...
-  pn         String? @db.VarChar(255)
-  pp         String? @db.VarChar(255)
-  kp         String? @db.VarChar(255)
-  pkpn       String? @db.VarChar(255)
-  sp         String? @db.VarChar(255)
-  isp        String? @db.VarChar(255)
-  satuanIsp  String? @db.VarChar(50)
-  sk         String? @db.VarChar(255)
-  isk        String? @db.VarChar(255)
-  satuanIsk  String? @db.VarChar(50)
-  iro        String? @db.VarChar(255)
-  satuanIro  String? @db.VarChar(50)
-  tematikRenja String? @db.VarChar(255)
+  kegiatanPrioritasId String?
+  kegiatanPrioritas   KegiatanPrioritas? @relation(fields: [kegiatanPrioritasId], references: [id])
+
+  pkpnId String?
+  pkpn   Pkpn?   @relation(fields: [pkpnId], references: [id])
+
+  indikatorSasaranProgramId String?
+  indikatorSasaranProgram   IndikatorSasaranProgram? @relation(fields: [indikatorSasaranProgramId], references: [id])
+
+  indikatorSasaranKegiatanId String?
+  indikatorSasaranKegiatan   IndikatorSasaranKegiatan? @relation(fields: [indikatorSasaranKegiatanId], references: [id])
+
+  indikatorRoId String?
+  indikatorRo   IndikatorRO? @relation(fields: [indikatorRoId], references: [id])
+
+  tematikRenjaId String?
+  tematikRenja   TematikRenja? @relation(fields: [tematikRenjaId], references: [id])
   ...
}
```

Model master baru:

```prisma
model PrioritasNasional {
  id   String @id @default(cuid())
  code String @unique @db.VarChar(10) // "02"
  name String @db.Text

  programPrioritas ProgramPrioritas[]
  @@map("prioritas_nasional")
}

model ProgramPrioritas {
  id                  String            @id @default(cuid())
  prioritasNasionalId String
  prioritasNasional   PrioritasNasional @relation(fields: [prioritasNasionalId], references: [id])
  code                String            @db.VarChar(10) // "02.12"
  name                String            @db.VarChar(255)

  kegiatanPrioritas KegiatanPrioritas[]
  @@map("program_prioritas")
}

model KegiatanPrioritas {
  id                 String           @id @default(cuid())
  programPrioritasId String
  programPrioritas   ProgramPrioritas @relation(fields: [programPrioritasId], references: [id])
  code               String           @db.VarChar(15) // "02.12.01"
  name               String           @db.VarChar(255)

  paket Paket[]
  @@map("kegiatan_prioritas")
}

model Pkpn {
  id   String @id @default(cuid())
  name String @db.VarChar(255)

  paket Paket[]
  @@map("pkpn")
}

model TematikRenja {
  id   String @id @default(cuid())
  name String @db.VarChar(100)

  paket Paket[]
  @@map("tematik_renja")
}

model SasaranProgram {
  id        String  @id @default(cuid())
  programId String  @db.VarChar(10)
  program   Program @relation(fields: [programId], references: [id])
  name      String  @db.Text

  indikator IndikatorSasaranProgram[]
  @@map("sasaran_program")
}

model IndikatorSasaranProgram {
  id               String         @id @default(cuid())
  sasaranProgramId String
  sasaranProgram   SasaranProgram @relation(fields: [sasaranProgramId], references: [id])
  name             String         @db.Text
  satuan           String?        @db.VarChar(50)

  paket Paket[]
  @@map("indikator_sasaran_program")
}

model SasaranKegiatan {
  id         String   @id @default(cuid())
  kegiatanId String   @db.VarChar(10)
  kegiatan   Kegiatan @relation(fields: [kegiatanId], references: [id])
  name       String   @db.Text

  indikator IndikatorSasaranKegiatan[]
  @@map("sasaran_kegiatan")
}

model IndikatorSasaranKegiatan {
  id                String          @id @default(cuid())
  sasaranKegiatanId String
  sasaranKegiatan   SasaranKegiatan @relation(fields: [sasaranKegiatanId], references: [id])
  name              String          @db.Text
  satuan            String?         @db.VarChar(50)

  paket Paket[]
  @@map("indikator_sasaran_kegiatan")
}
```

`IndikatorRO` (sudah ada) tambah relasi balik `paket Paket[]`.

## 6. Dampak ke backend/frontend yang sudah dibangun

- `paket.service.ts`/`paket.controller.ts`, `CreatePaketDto`/`PaketDto` (nested di planning): field `pn/pp/kp/pkpn/sp/isp/satuanIsp/sk/isk/satuanIsk/iro/satuanIro/tematikRenja` (12 field string bebas) diganti jadi 6 field FK (`kegiatanPrioritasId`, `pkpnId`, `indikatorSasaranProgramId`, `indikatorSasaranKegiatanId`, `indikatorRoId`, `tematikRenjaId`) — **lebih sederhana**, bukan lebih rumit.
- `master.service.ts`/`master.controller.ts`: tambah CRUD untuk `PrioritasNasional`/`ProgramPrioritas`/`KegiatanPrioritas` (cascading select 3 level, pola sama Program/Kegiatan/KRO), `Pkpn`, `TematikRenja` (flat, pola sama `MajorProject`/`TindakLanjut`), `SasaranProgram`+`IndikatorSasaranProgram` (nested di bawah Program), `SasaranKegiatan`+`IndikatorSasaranKegiatan` (nested di bawah Kegiatan).
- `PaketQuickFormDialog` di `planning-detail-sheet.tsx` **tidak terpengaruh** (field ini memang belum ada di quick-add, cuma nanti relevan saat form Paket lengkap dibangun — `03-ui.md` §3).
- Seed data awal untuk master baru ini: import dari sheet PNPPKP/SPSK/Tagging RENJA — bisa 1 script gabungan dengan RSPP importer di rekomendasi §1.

## 7. Ringkasan keputusan yang perlu dikonfirmasi user

1. Tambah (bukan ganti) nomenklatur dari RSPP ke `kro-ro-master.json`/DB — boleh dikerjakan sekarang?
2. Nama RO `7694.RBS.004` yang benar yang mana (RSPP vs yang sudah dipakai)?
3. Field PN/PP/KP/SP/ISP/SK/ISK/IRO/Tematik/PKPN di skema Paket diganti jadi FK master (bukan lagi teks bebas) — ini rekomendasi kuat dari temuan di atas, dianggap disetujui kecuali dikoreksi.
