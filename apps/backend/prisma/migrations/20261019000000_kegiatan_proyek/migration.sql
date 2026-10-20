-- Kegiatan disimpan di proyek (Kegiatan -> Proyek -> Paket satu jalur).
ALTER TABLE "proyek" ADD COLUMN "kegiatanId" VARCHAR(10);
ALTER TABLE "proyek" ADD CONSTRAINT "proyek_kegiatanId_fkey"
  FOREIGN KEY ("kegiatanId") REFERENCES "kegiatan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "proyek_kegiatanId_idx" ON "proyek"("kegiatanId");

-- Data lama: kegiatan RO paket pertama (paket aktif, urut dibuat).
UPDATE "proyek" p SET "kegiatanId" = x."kegiatanId"
FROM (
  SELECT DISTINCT ON (pa."proyekId") pa."proyekId", k."kegiatanId"
  FROM "paket" pa
  JOIN "ro" r ON r."id" = pa."roId"
  JOIN "kro" k ON k."id" = r."kroId"
  WHERE pa."deletedAt" IS NULL
  ORDER BY pa."proyekId", pa."createdAt", pa."id"
) x
WHERE p."id" = x."proyekId";

-- Belum punya paket: kegiatan balai.
UPDATE "proyek" p SET "kegiatanId" = b."kegiatanId"
FROM "balai" b
WHERE p."kegiatanId" IS NULL AND b."id" = p."balaiId" AND b."kegiatanId" IS NOT NULL;
-- Paket yang RO-nya dari kegiatan lain tidak diubah: aplikasi menandainya
-- "Harus dibuat ulang" (data lama yang salah).
