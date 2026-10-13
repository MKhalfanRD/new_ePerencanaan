-- Wilayah administratif lokasi paket sendiri.
ALTER TABLE "paket"
    ADD COLUMN "provinceId" VARCHAR(10),
    ADD COLUMN "provinceName" VARCHAR(100),
    ADD COLUMN "cityId" VARCHAR(10),
    ADD COLUMN "cityName" VARCHAR(100),
    ADD COLUMN "districtId" VARCHAR(10),
    ADD COLUMN "districtName" VARCHAR(100),
    ADD COLUMN "villageId" VARCHAR(10),
    ADD COLUMN "villageName" VARCHAR(100);
