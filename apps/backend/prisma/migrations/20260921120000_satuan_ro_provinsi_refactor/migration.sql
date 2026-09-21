-- CreateTable: Satuan (master dropdown, dipakai RO/Komponen/Indikator RO)
CREATE TABLE "satuan" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satuan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "satuan_name_key" ON "satuan"("name");

-- CreateTable: RoProvinsi (1 RO bisa mencakup banyak provinsi)
CREATE TABLE "ro_provinsi" (
    "id" TEXT NOT NULL,
    "roId" VARCHAR(20) NOT NULL,
    "provinceId" VARCHAR(10) NOT NULL,
    "provinceName" VARCHAR(100) NOT NULL,

    CONSTRAINT "ro_provinsi_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ro_provinsi_roId_provinceId_key" ON "ro_provinsi"("roId", "provinceId");
ALTER TABLE "ro_provinsi" ADD CONSTRAINT "ro_provinsi_roId_fkey" FOREIGN KEY ("roId") REFERENCES "ro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: IndikatorRoSatuan (1 Indikator RO bisa punya banyak satuan)
CREATE TABLE "indikator_ro_satuan" (
    "id" TEXT NOT NULL,
    "indikatorRoId" TEXT NOT NULL,
    "satuanId" TEXT NOT NULL,

    CONSTRAINT "indikator_ro_satuan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "indikator_ro_satuan_indikatorRoId_satuanId_key" ON "indikator_ro_satuan"("indikatorRoId", "satuanId");
ALTER TABLE "indikator_ro_satuan" ADD CONSTRAINT "indikator_ro_satuan_indikatorRoId_fkey" FOREIGN KEY ("indikatorRoId") REFERENCES "indikator_ro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "indikator_ro_satuan" ADD CONSTRAINT "indikator_ro_satuan_satuanId_fkey" FOREIGN KEY ("satuanId") REFERENCES "satuan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: ro.satuan (text) -> ro.satuanId (FK), kolom baru dulu, drop lama belakangan
ALTER TABLE "ro" ADD COLUMN "satuanId" TEXT;
ALTER TABLE "ro" ADD CONSTRAINT "ro_satuanId_fkey" FOREIGN KEY ("satuanId") REFERENCES "satuan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: komponen tambah satuanId (kolom baru, tidak ada data lama)
ALTER TABLE "komponen" ADD COLUMN "satuanId" TEXT;
ALTER TABLE "komponen" ADD CONSTRAINT "komponen_satuanId_fkey" FOREIGN KEY ("satuanId") REFERENCES "satuan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: setiap nilai distinct ro.satuan (teks lama) jadi baris Satuan,
-- lalu ro.satuanId diisi merujuk ke baris itu, baru kolom teks lama didrop.
INSERT INTO "satuan" ("id", "name")
SELECT gen_random_uuid()::text, "satuan"
FROM "ro"
WHERE "satuan" IS NOT NULL AND "satuan" <> ''
GROUP BY "satuan"
ON CONFLICT ("name") DO NOTHING;

UPDATE "ro"
SET "satuanId" = "satuan"."id"
FROM "satuan"
WHERE "ro"."satuan" = "satuan"."name";

ALTER TABLE "ro" DROP COLUMN "satuan";

-- indikator_ro.satuan: tabel kosong saat migrasi ini dibuat, aman didrop langsung
-- (satuan indikator sekarang lewat join table indikator_ro_satuan di atas).
ALTER TABLE "indikator_ro" DROP COLUMN "satuan";
