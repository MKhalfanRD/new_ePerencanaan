-- Kode satker otomatis (SK0001, ...) — satker lama diberi kode urut dibuat.
ALTER TABLE "satker" ADD COLUMN "kode" VARCHAR(20);
UPDATE "satker" s SET "kode" = 'SK' || LPAD(n::text, 4, '0')
FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS n FROM "satker") u
WHERE s."id" = u."id";
ALTER TABLE "satker" ALTER COLUMN "kode" SET NOT NULL;
CREATE UNIQUE INDEX "satker_kode_key" ON "satker"("kode");
