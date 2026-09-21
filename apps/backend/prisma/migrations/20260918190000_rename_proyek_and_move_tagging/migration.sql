-- Rename Planning -> Proyek (rename, bukan drop+create, supaya data lama
-- tidak hilang) + pindahkan tagging (PKPN/ISP/ISK/Tematik/fkb/fkw/mpa/
-- catatan) dari Paket ke Proyek (1 proyek = 1 set tagging) + tabel baru
-- dokumen_pendukung. Lihat plan "Rombak Modal Proyek jadi 7 Tab".

-- === 1. Rename tabel & tipe enum ===
ALTER TABLE "plannings" RENAME TO "proyek";
ALTER TYPE "PlanningStatus" RENAME TO "StatusProyek";

ALTER TABLE "planning_evaluasi" RENAME TO "proyek_evaluasi";
ALTER TABLE "proyek_evaluasi" RENAME COLUMN "planningId" TO "proyekId";
ALTER TABLE "proyek_evaluasi" RENAME CONSTRAINT "planning_evaluasi_pkey" TO "proyek_evaluasi_pkey";
ALTER INDEX "planning_evaluasi_itemId_idx" RENAME TO "proyek_evaluasi_itemId_idx";
ALTER TABLE "proyek_evaluasi" RENAME CONSTRAINT "planning_evaluasi_planningId_fkey" TO "proyek_evaluasi_proyekId_fkey";
ALTER TABLE "proyek_evaluasi" RENAME CONSTRAINT "planning_evaluasi_itemId_fkey" TO "proyek_evaluasi_itemId_fkey";

ALTER TABLE "paket" RENAME COLUMN "planningId" TO "proyekId";
ALTER TABLE "paket" RENAME CONSTRAINT "paket_planningId_fkey" TO "paket_proyekId_fkey";

ALTER TABLE "proyek" RENAME CONSTRAINT "plannings_pkey" TO "proyek_pkey";
ALTER TABLE "proyek" RENAME CONSTRAINT "plannings_balaiId_fkey" TO "proyek_balaiId_fkey";
ALTER TABLE "proyek" RENAME CONSTRAINT "plannings_periodeId_fkey" TO "proyek_periodeId_fkey";
ALTER TABLE "proyek" RENAME CONSTRAINT "plannings_createdById_fkey" TO "proyek_createdById_fkey";

-- === 2. Field baru di Proyek (tab Dasar Pelaksanaan + Tagging + Dokumen&Catatan) ===
ALTER TABLE "proyek"
  ADD COLUMN "justifikasiProyek" TEXT,
  ADD COLUMN "catatanPembina" TEXT,
  ADD COLUMN "catatanSspsda" TEXT,
  ADD COLUMN "pkpnId" TEXT,
  ADD COLUMN "indikatorSasaranProgramId" TEXT,
  ADD COLUMN "indikatorSasaranKegiatanId" TEXT,
  ADD COLUMN "tematikRenjaId" TEXT,
  ADD COLUMN "fkb" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fkw" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mpa" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taggingDinamis" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- === 3. Backfill dari Paket (ambil dari paket tertua per proyek, best-effort
-- — tagging dulu per-paket, sekarang 1 set per proyek) ===
UPDATE "proyek" p
SET
  "catatanPembina" = src."catatanPembina",
  "catatanSspsda" = src."catatanSspsda",
  "pkpnId" = src."pkpnId",
  "indikatorSasaranProgramId" = src."indikatorSasaranProgramId",
  "indikatorSasaranKegiatanId" = src."indikatorSasaranKegiatanId",
  "tematikRenjaId" = src."tematikRenjaId",
  "fkb" = src."fkb",
  "fkw" = src."fkw",
  "mpa" = src."mpa"
FROM (
  SELECT DISTINCT ON ("proyekId")
    "proyekId", "catatanPembina", "catatanSspsda", "pkpnId",
    "indikatorSasaranProgramId", "indikatorSasaranKegiatanId", "tematikRenjaId",
    "fkb", "fkw", "mpa"
  FROM "paket"
  ORDER BY "proyekId", "createdAt" ASC
) src
WHERE p."id" = src."proyekId";

-- === 4. FK constraints untuk kolom tagging baru di Proyek ===
ALTER TABLE "proyek" ADD CONSTRAINT "proyek_pkpnId_fkey" FOREIGN KEY ("pkpnId") REFERENCES "pkpn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "proyek" ADD CONSTRAINT "proyek_indikatorSasaranProgramId_fkey" FOREIGN KEY ("indikatorSasaranProgramId") REFERENCES "indikator_sasaran_program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "proyek" ADD CONSTRAINT "proyek_indikatorSasaranKegiatanId_fkey" FOREIGN KEY ("indikatorSasaranKegiatanId") REFERENCES "indikator_sasaran_kegiatan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "proyek" ADD CONSTRAINT "proyek_tematikRenjaId_fkey" FOREIGN KEY ("tematikRenjaId") REFERENCES "tematik_renja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === 5. Drop field yang sudah pindah dari Paket ===
ALTER TABLE "paket" DROP CONSTRAINT IF EXISTS "paket_pkpnId_fkey";
ALTER TABLE "paket" DROP CONSTRAINT IF EXISTS "paket_indikatorSasaranProgramId_fkey";
ALTER TABLE "paket" DROP CONSTRAINT IF EXISTS "paket_indikatorSasaranKegiatanId_fkey";
ALTER TABLE "paket" DROP CONSTRAINT IF EXISTS "paket_tematikRenjaId_fkey";

ALTER TABLE "paket"
  DROP COLUMN IF EXISTS "catatanPembina",
  DROP COLUMN IF EXISTS "catatanSspsda",
  DROP COLUMN IF EXISTS "pkpnId",
  DROP COLUMN IF EXISTS "indikatorSasaranProgramId",
  DROP COLUMN IF EXISTS "indikatorSasaranKegiatanId",
  DROP COLUMN IF EXISTS "tematikRenjaId",
  DROP COLUMN IF EXISTS "fkb",
  DROP COLUMN IF EXISTS "fkw",
  DROP COLUMN IF EXISTS "mpa";

-- === 6. Tabel dokumen_pendukung ===
CREATE TABLE "dokumen_pendukung" (
    "id" TEXT NOT NULL,
    "proyekId" TEXT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dokumen_pendukung_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dokumen_pendukung_proyekId_idx" ON "dokumen_pendukung"("proyekId");

ALTER TABLE "dokumen_pendukung" ADD CONSTRAINT "dokumen_pendukung_proyekId_fkey" FOREIGN KEY ("proyekId") REFERENCES "proyek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dokumen_pendukung" ADD CONSTRAINT "dokumen_pendukung_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
