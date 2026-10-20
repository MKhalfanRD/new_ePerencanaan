-- FKB / FKW / MPA: dari Ya/Tidak menjadi daftar tahun per proyek.
-- Data lama yang tercentang dianggap berlaku di semua tahun rencana paketnya.
ALTER TABLE "proyek" ADD COLUMN "fkb_tahun" SMALLINT[] NOT NULL DEFAULT '{}';
ALTER TABLE "proyek" ADD COLUMN "fkw_tahun" SMALLINT[] NOT NULL DEFAULT '{}';
ALTER TABLE "proyek" ADD COLUMN "mpa_tahun" SMALLINT[] NOT NULL DEFAULT '{}';

UPDATE "proyek" p SET
  "fkb_tahun" = CASE WHEN p."fkb" THEN t.tahun ELSE '{}' END,
  "fkw_tahun" = CASE WHEN p."fkw" THEN t.tahun ELSE '{}' END,
  "mpa_tahun" = CASE WHEN p."mpa" THEN t.tahun ELSE '{}' END
FROM (
  SELECT p2.id, COALESCE(ARRAY(
    SELECT DISTINCT a.tahun FROM "alokasi" a JOIN "paket" k ON k.id = a."paketId"
    WHERE k."proyekId" = p2.id AND k."deletedAt" IS NULL AND a.status = 'RENCANA' ORDER BY a.tahun
  ), '{}') AS tahun
  FROM "proyek" p2
) t
WHERE t.id = p.id;

ALTER TABLE "proyek" DROP COLUMN "fkb";
ALTER TABLE "proyek" DROP COLUMN "fkw";
ALTER TABLE "proyek" DROP COLUMN "mpa";
ALTER TABLE "proyek" RENAME COLUMN "fkb_tahun" TO "fkb";
ALTER TABLE "proyek" RENAME COLUMN "fkw_tahun" TO "fkw";
ALTER TABLE "proyek" RENAME COLUMN "mpa_tahun" TO "mpa";
