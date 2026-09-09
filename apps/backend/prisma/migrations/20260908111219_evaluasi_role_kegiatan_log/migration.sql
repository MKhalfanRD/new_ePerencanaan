CREATE TYPE "KriteriaEvaluasi" AS ENUM ('URGENSITAS', 'KESIAPAN_TEKNIS', 'TEMATIK', 'VALUASI');

-- AlterTable: kolom baru di plannings DULU, supaya data dari paket bisa dipindah
-- sebelum kolom asalnya dihapus.
ALTER TABLE "plannings" ADD COLUMN     "kegiatanPrioritasId" TEXT,
ADD COLUMN     "skorEvaluasi" DECIMAL(6,4),
ADD COLUMN     "wilayahSungaiId" TEXT;

-- Pindahkan wilayah sungai & kegiatan prioritas dari paket ke proyek induknya.
-- Kalau satu proyek punya beberapa paket dengan nilai berbeda, yang dipakai
-- adalah paket terlama.
UPDATE "plannings" p
SET "wilayahSungaiId" = sub."wilayahSungaiId",
    "kegiatanPrioritasId" = sub."kegiatanPrioritasId"
FROM (
  SELECT DISTINCT ON ("planningId")
         "planningId", "wilayahSungaiId", "kegiatanPrioritasId"
  FROM "paket"
  WHERE "deletedAt" IS NULL
  ORDER BY "planningId", "createdAt" ASC
) sub
WHERE p.id = sub."planningId";

ALTER TABLE "paket" DROP CONSTRAINT "paket_kegiatanPrioritasId_fkey";

ALTER TABLE "paket" DROP CONSTRAINT "paket_wilayahSungaiId_fkey";

-- AlterTable
ALTER TABLE "paket" DROP COLUMN "kegiatanPrioritasId",
DROP COLUMN "wilayahSungaiId";

-- AlterTable: kolom kesesuaian lama (RTRW/Pola SDA/Masterplan) tidak dipakai lagi.
ALTER TABLE "plannings" DROP COLUMN "nomorKepmenPUPR",
DROP COLUMN "nomorPerdaRTRW",
DROP COLUMN "polaRencana",
DROP COLUMN "sesuaiMasterplan",
DROP COLUMN "sesuaiPolaSDA",
DROP COLUMN "sesuaiRTRW";

ALTER TABLE "roles" ADD COLUMN     "kegiatanId" VARCHAR(10);

-- CreateTable
CREATE TABLE "evaluasi_item" (
    "id" TEXT NOT NULL,
    "kegiatanId" VARCHAR(10) NOT NULL,
    "kriteria" "KriteriaEvaluasi" NOT NULL,
    "urutan" SMALLINT NOT NULL,
    "name" TEXT NOT NULL,
    "score" SMALLINT NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluasi_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_evaluasi" (
    "planningId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "keterangan" TEXT,

    CONSTRAINT "planning_evaluasi_pkey" PRIMARY KEY ("planningId","itemId")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "username" VARCHAR(50) NOT NULL,
    "roleCode" VARCHAR(50),
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "entity" VARCHAR(50),
    "entityId" VARCHAR(60),
    "statusCode" SMALLINT NOT NULL,
    "ip" VARCHAR(45),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluasi_item_kegiatanId_kriteria_idx" ON "evaluasi_item"("kegiatanId", "kriteria");

-- CreateIndex
CREATE INDEX "planning_evaluasi_itemId_idx" ON "planning_evaluasi"("itemId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_kegiatanId_fkey" FOREIGN KEY ("kegiatanId") REFERENCES "kegiatan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluasi_item" ADD CONSTRAINT "evaluasi_item_kegiatanId_fkey" FOREIGN KEY ("kegiatanId") REFERENCES "kegiatan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_evaluasi" ADD CONSTRAINT "planning_evaluasi_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "plannings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_evaluasi" ADD CONSTRAINT "planning_evaluasi_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "evaluasi_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_wilayahSungaiId_fkey" FOREIGN KEY ("wilayahSungaiId") REFERENCES "wilayah_sungai"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_kegiatanPrioritasId_fkey" FOREIGN KEY ("kegiatanPrioritasId") REFERENCES "kegiatan_prioritas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
