# Migrasi: Evaluasi, Role per Kegiatan, Log Aktivitas

Database tidak bisa dijangkau saat perubahan ini dibuat (`localhost:5432` mati),
jadi migrasinya **belum dijalankan**. Schema Prisma sudah diperbarui dan
`prisma generate` sudah jalan; tinggal menerapkannya ke DB.

## Perubahan skema

**Ditambah**

- `Role.baseRole` — template izin yang dipinjam role turunan. Izin di kode
  ditempel ke KODE role (`@Roles('SATKER', ...)`), jadi role baru dari UI
  ditolak semua endpoint kalau tidak menunjuk template. `OPERATOR_7691`
  ber-baseRole `SATKER` lolos di semua `@Roles('SATKER')`, lalu tetap
  disaring per kegiatan. Lihat `src/auth/role.ts`.
- `Role.kegiatanId` — cakupan kegiatan sebuah role (mis. `7691`). Kosong =
  lintas kegiatan, dan itu hanya sah untuk `SUPER_ADMIN` & `ADMINISTRATOR`.
- `EvaluasiItem` + `PlanningEvaluasi` — master item evaluasi (MCA) per
  kegiatan dan tagging-nya per proyek.
- `Planning.skorEvaluasi` — hasil hitung MCA (0..1).
- `Planning.wilayahSungaiId`, `Planning.kegiatanPrioritasId` — pindahan dari
  `Paket`.
- `ActivityLog` — jejak audit semua mutasi.

**Dibuang dari `Planning`** (tidak dipakai lagi di form Kesesuaian Proyek):
`sesuaiRTRW`, `nomorPerdaRTRW`, `sesuaiPolaSDA`, `nomorKepmenPUPR`,
`sesuaiMasterplan`, `polaRencana`.

**Dibuang dari `Paket`**: `wilayahSungaiId`, `kegiatanPrioritasId` (pindah ke
`Planning`).

## Langkah

```bash
cd apps/backend

# 1. Buat migrasi TANPA langsung menjalankannya, supaya SQL-nya bisa disisipi
#    pemindahan data dari paket -> plannings.
npx prisma migrate dev --create-only --name evaluasi-role-kegiatan-log
```

Buka file `prisma/migrations/<timestamp>_evaluasi_role_kegiatan_log/migration.sql`,
lalu **sisipkan blok di bawah ini di antara** `ALTER TABLE "plannings" ADD COLUMN ...`
dan `ALTER TABLE "paket" DROP COLUMN ...` — kalau tidak, isi wilayah sungai &
kegiatan prioritas yang sudah terlanjur diisi di paket akan hilang:

```sql
-- Wilayah sungai & kegiatan prioritas naik dari paket ke proyek induknya.
-- Tiap kolom diambil TERPISAH: nilai terisi paling awal di antara paket-paket
-- proyek itu. Jangan pakai DISTINCT ON yang mengambil satu baris utuh — kalau
-- wilayah sungai ada di paket pertama tapi kegiatan prioritas cuma diisi di
-- paket kedua, nilai KP-nya ikut hilang.
UPDATE "plannings" p
SET "wilayahSungaiId" = sub.ws,
    "kegiatanPrioritasId" = sub.kp
FROM (
  SELECT "planningId",
         (array_remove(array_agg("wilayahSungaiId" ORDER BY "createdAt"), NULL))[1] AS ws,
         (array_remove(array_agg("kegiatanPrioritasId" ORDER BY "createdAt"), NULL))[1] AS kp
  FROM "paket"
  WHERE "deletedAt" IS NULL
  GROUP BY "planningId"
) sub
WHERE p.id = sub."planningId";
```

```bash
# 2. Terapkan migrasi yang sudah disunting.
npx prisma migrate dev

# 3. Role baru (SUPER_ADMIN + role per kegiatan) & master lainnya.
npx ts-node prisma/seed.ts

# 4. Master item evaluasi dari referensi 1.xlsx (sheet evaluasi Irwa/supan/
#    benda/atab -> kegiatan 7691/7692/7693/7694).
#    Cek dulu hasil parsing tanpa menulis DB:
npx ts-node prisma/scripts/seed-evaluasi-referensi1.ts --dry
npx ts-node prisma/scripts/seed-evaluasi-referensi1.ts
```

## Catatan

- Rumus skor: per kriteria, `score item tercentang / total score kriteria ×
  bobot kriteria` (Urgensitas 40%, Kesiapan Teknis 20%, Tematik 20%, Valuasi
  20%). Bobot ada di `src/plannings/evaluasi-skor.ts`, bukan di DB.
  Self-check: `npx ts-node src/plannings/evaluasi-skor.ts`.
- Sel ringkasan "criteria 4: Valuasi" di sheet `evaluasi Irwa` berisi 0
  padahal item valuasinya tercentang — formula di excel-nya memang tidak
  menunjuk ke blok valuasi. Implementasi di sini mengikuti metode yang
  tertulis (valuasi ikut dihitung), jadi total skor aplikasi bisa lebih
  tinggi dari sel "Total score" di excel.
- `seed-evaluasi-referensi1.ts` **mengganti** seluruh item evaluasi kegiatan
  yang bersangkutan tiap dijalankan; tagging proyek yang menunjuk item lama
  ikut terhapus (cascade).
