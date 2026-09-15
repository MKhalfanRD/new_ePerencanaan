-- Metode evaluasi (dulu enum "KriteriaEvaluasi" dengan bobot hardcoded di
-- kode) jadi tabel master, supaya bobotnya bisa diubah admin.

-- CreateTable
CREATE TABLE "metode_evaluasi" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "bobot" DOUBLE PRECISION NOT NULL,
    "urutan" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metode_evaluasi_pkey" PRIMARY KEY ("id")
);

-- Seed 4 metode lama dengan bobot yang sebelumnya hardcoded di
-- src/plannings/evaluasi-skor.ts (BOBOT_KRITERIA).
INSERT INTO "metode_evaluasi" ("id", "name", "bobot", "urutan", "updatedAt") VALUES
    ('metode_urgensitas', 'Urgensitas', 0.4, 1, CURRENT_TIMESTAMP),
    ('metode_kesiapan_teknis', 'Kesiapan Teknis', 0.2, 2, CURRENT_TIMESTAMP),
    ('metode_tematik', 'Tematik', 0.2, 3, CURRENT_TIMESTAMP),
    ('metode_valuasi', 'Valuasi', 0.2, 4, CURRENT_TIMESTAMP);

-- AlterTable: tambah metodeId, backfill dari kolom kriteria lama, baru
-- dikunci NOT NULL + FK, lalu kolom & enum lama dibuang.
ALTER TABLE "evaluasi_item" ADD COLUMN "metodeId" TEXT;

UPDATE "evaluasi_item" SET "metodeId" = CASE "kriteria"
    WHEN 'URGENSITAS' THEN 'metode_urgensitas'
    WHEN 'KESIAPAN_TEKNIS' THEN 'metode_kesiapan_teknis'
    WHEN 'TEMATIK' THEN 'metode_tematik'
    WHEN 'VALUASI' THEN 'metode_valuasi'
END;

ALTER TABLE "evaluasi_item" ALTER COLUMN "metodeId" SET NOT NULL;

DROP INDEX IF EXISTS "evaluasi_item_kegiatanId_kriteria_idx";
ALTER TABLE "evaluasi_item" DROP COLUMN "kriteria";
DROP TYPE IF EXISTS "KriteriaEvaluasi";

CREATE INDEX "evaluasi_item_kegiatanId_metodeId_idx" ON "evaluasi_item"("kegiatanId", "metodeId");

ALTER TABLE "evaluasi_item" ADD CONSTRAINT "evaluasi_item_metodeId_fkey" FOREIGN KEY ("metodeId") REFERENCES "metode_evaluasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
