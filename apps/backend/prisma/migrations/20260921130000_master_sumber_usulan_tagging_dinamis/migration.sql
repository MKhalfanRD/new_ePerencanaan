-- CreateEnum
CREATE TYPE "StatusKriteriaTeknis" AS ENUM ('RENCANA', 'SUDAH_ADA', 'TIDAK_PERLU');

-- CreateTable: master data Sumber Usulan Proyek (dulu enum hardcode)
CREATE TABLE "sumber_usulan_proyek" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "sumber_usulan_proyek_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sumber_usulan_proyek_name_key" ON "sumber_usulan_proyek"("name");

-- CreateTable: master data Tagging Dinamis (dulu free-text)
CREATE TABLE "tagging_dinamis" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "tagging_dinamis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tagging_dinamis_name_key" ON "tagging_dinamis"("name");

-- AlterTable proyek: tambah status kesiapan per dokumen kriteria teknis
ALTER TABLE "proyek"
    ADD COLUMN "statusStudiLayak" "StatusKriteriaTeknis" DEFAULT 'RENCANA',
    ADD COLUMN "statusDed" "StatusKriteriaTeknis" DEFAULT 'RENCANA',
    ADD COLUMN "statusLarap" "StatusKriteriaTeknis" DEFAULT 'RENCANA',
    ADD COLUMN "statusDokumenLingkungan" "StatusKriteriaTeknis" DEFAULT 'RENCANA';

-- AlterTable proyek: sumberUsulanProyek dari enum hardcode -> teks nama
-- (dicocokkan ke master data "sumber_usulan_proyek", bukan FK id — lihat
-- plan tab dinamis form proyek). Backfill data lama ke label baru yang
-- persis sama dengan yang diseed di prisma/scripts/seed-sumber-usulan-proyek.ts,
-- supaya evaluasi-deteksi.ts tetap cocok.
ALTER TABLE "proyek" ADD COLUMN "sumberUsulanProyek_new" VARCHAR(255);

UPDATE "proyek" SET "sumberUsulanProyek_new" = CASE "sumberUsulanProyek"
    WHEN 'PEMERINTAH_DAERAH' THEN 'Pemerintah Daerah'
    WHEN 'KEMENTERIAN_LEMBAGA' THEN 'Kementerian/Lembaga'
    WHEN 'MASYARAKAT' THEN 'Masyarakat'
    WHEN 'TINDAK_LANJUT_RENAKSI' THEN 'Tindak Lanjut Renaksi'
    WHEN 'LAINNYA' THEN 'Lainnya'
    ELSE NULL
END;

ALTER TABLE "proyek" DROP COLUMN "sumberUsulanProyek";
ALTER TABLE "proyek" RENAME COLUMN "sumberUsulanProyek_new" TO "sumberUsulanProyek";

DROP TYPE "SumberUsulanProyek";
