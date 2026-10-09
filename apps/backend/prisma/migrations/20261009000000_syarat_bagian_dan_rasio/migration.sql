-- 1) Syarat tampil per BAGIAN (form_section): bagian hanya tampil &
--    dihitung kalau field pemicu bernilai salah satu dari conditionValue.
ALTER TABLE "form_section" ADD COLUMN "conditionItemId" VARCHAR(100);
ALTER TABLE "form_section" ADD COLUMN "conditionValue" TEXT;

-- Pindahkan syarat lama yang menempel di SEMUA field akar sebuah bagian
-- (mis. "Khusus kategori pembangunan jaringan" -> kategoriProyek) ke
-- bagiannya, supaya terlihat & bisa diubah admin dari panel Atur bagian.
-- Field akar = field yang syaratnya tidak menunjuk field lain di bagian
-- yang sama (bukan kolom tambahan).
WITH akar AS (
  SELECT i.id, i."sectionId", i."conditionItemId" AS ck,
    CASE WHEN i."conditionValue" LIKE '[%' THEN i."conditionValue"
         WHEN i."conditionValue" IS NULL THEN NULL
         ELSE json_build_array(i."conditionValue")::text END AS cv
  FROM "form_item" i
  WHERE i."conditionItemId" IS NULL
     OR NOT EXISTS (SELECT 1 FROM "form_item" p
                    WHERE p."sectionId" = i."sectionId" AND p.key = i."conditionItemId")
),
seragam AS (
  SELECT "sectionId", MIN(ck) AS ck, MIN(cv) AS cv
  FROM akar
  GROUP BY "sectionId"
  HAVING COUNT(*) > 0
     AND COUNT(*) = COUNT(ck)
     AND COUNT(DISTINCT ck) = 1
     AND COUNT(DISTINCT cv) = 1
),
pindah AS (
  UPDATE "form_section" s
  SET "conditionItemId" = g.ck, "conditionValue" = g.cv
  FROM seragam g
  WHERE s.id = g."sectionId"
  RETURNING s.id
)
UPDATE "form_item" i
SET "conditionItemId" = NULL, "conditionValue" = NULL
FROM akar a
WHERE a.id = i.id AND a."sectionId" IN (SELECT id FROM pindah);

-- 2) Field tipe RASIO: rumus pembilang:penyebut, simbol syarat & satuan
--    standar diatur admin (dulu rumus tetap di kode).
ALTER TABLE "form_item" ADD COLUMN "rasio" JSONB;

UPDATE "form_item" SET "fieldType" = 'RASIO',
  "rasio" = '{"pembilang":"A","penyebut":"B","operator":"<","satuan":"juta"}'
WHERE key = 'rasioAnggaranOutput' AND "thresholdValue" IS NOT NULL;
UPDATE "form_item" SET "fieldType" = 'RASIO',
  "rasio" = '{"pembilang":"A","penyebut":"C","operator":"<","satuan":"juta"}'
WHERE key = 'rasioAnggaranOutcome' AND "thresholdValue" IS NOT NULL;
-- Sesuai Excel: outcome (C) : output (B). Rumus lama di kode terbalik.
UPDATE "form_item" SET "fieldType" = 'RASIO',
  "rasio" = '{"pembilang":"C","penyebut":"B","operator":"<","satuan":"juta"}'
WHERE key = 'rasioOutputOutcome' AND "thresholdValue" IS NOT NULL;
