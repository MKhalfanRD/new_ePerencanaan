-- Lokasi Proyek disamakan dengan lokasi_alokasi (titik/garis/poligon +
-- wilayah sampai desa).
ALTER TABLE "proyek" ADD COLUMN "tipeKoordinat" "TipeKoordinat" NOT NULL DEFAULT 'TITIK',
ADD COLUMN "provinceName" VARCHAR(100),
ADD COLUMN "cityName" VARCHAR(100),
ADD COLUMN "districtId" VARCHAR(10),
ADD COLUMN "districtName" VARCHAR(100),
ADD COLUMN "villageId" VARCHAR(10),
ADD COLUMN "villageName" VARCHAR(100),
ADD COLUMN "coordinates" JSONB;

-- Tab Lokasi di Form Proyek: Provinsi + Kab/Kota digabung jadi satu item
-- "Wilayah Administratif" (provinsi s/d desa, satu komponen bertingkat),
-- "Titik Lokasi" jadi "Peta Lokasi" (titik/garis/poligon).
DELETE FROM "form_item" WHERE "key" = 'cityId' AND "sectionId" IN (
  SELECT s."id" FROM "form_section" s JOIN "form_tab" t ON t."id" = s."tabId" WHERE t."key" = 'lokasi'
);
UPDATE "form_item" SET "label" = 'Wilayah Administratif', "width" = 'FULL' WHERE "key" = 'provinceId';
UPDATE "form_item" SET "label" = 'Peta Lokasi', "width" = 'FULL' WHERE "key" = 'latitude';
