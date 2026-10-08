-- Skor field/pilihan Form Proyek jadi BOBOT % LANGSUNG (desimal).
-- Dulu: nilai tab = skor didapat / skor maksimum tab x bobot tab.
-- Sekarang: nilai tab = jumlah bobot didapat (maks = bobot tab x 100).
-- Skor lama dikonversi: skor x (bobot tab x 100) / skor maksimum tab,
-- supaya hasil penilaian yang ada tidak berubah.
--
-- Skor maksimum tab dihitung per skenario terbaik (sama dengan
-- maksTab() di form-skor.ts): field tanpa syarat dijumlah; field bersyarat
-- (mis. "Khusus kategori pembangunan jaringan") dikelompokkan per field
-- pemicu, diambil kelompok nilai pemicu dengan jumlah terbesar.

ALTER TABLE "form_item" ALTER COLUMN "score" TYPE DOUBLE PRECISION;
ALTER TABLE "form_item_option" ALTER COLUMN "score" TYPE DOUBLE PRECISION;

CREATE TEMP TABLE _tab_maks AS
WITH it AS (
  SELECT i.id, s."tabId", i."conditionItemId" AS ck, i."conditionValue" AS cv,
    CASE
      WHEN EXISTS (SELECT 1 FROM "form_item_option" o WHERE o."itemId" = i.id AND o."isActive")
        THEN CASE WHEN i."fieldType" = 'CHECKBOX'
          THEN (SELECT COALESCE(SUM(o.score), 0) FROM "form_item_option" o WHERE o."itemId" = i.id AND o."isActive")
          ELSE (SELECT GREATEST(COALESCE(MAX(o.score), 0), 0) FROM "form_item_option" o WHERE o."itemId" = i.id AND o."isActive")
        END
      ELSE COALESCE(i.score, 0)
    END AS maks
  FROM "form_item" i
  JOIN "form_section" s ON s.id = i."sectionId"
  WHERE i."isActive" AND s."isActive"
),
nilai AS (
  SELECT it."tabId", it.ck, v.val, it.maks
  FROM it
  CROSS JOIN LATERAL (
    SELECT jsonb_array_elements_text(it.cv::jsonb) AS val WHERE it.cv LIKE '[%'
    UNION ALL
    SELECT it.cv WHERE it.cv IS NOT NULL AND it.cv NOT LIKE '[%'
  ) v
  WHERE it.ck IS NOT NULL
),
per_nilai AS (SELECT "tabId", ck, val, SUM(maks) AS m FROM nilai GROUP BY 1, 2, 3),
per_pemicu AS (SELECT "tabId", ck, MAX(m) AS m FROM per_nilai GROUP BY 1, 2)
SELECT t.id AS "tabId", t.bobot,
  COALESCE((SELECT SUM(maks) FROM it WHERE it."tabId" = t.id AND it.ck IS NULL), 0)
  + COALESCE((SELECT SUM(m) FROM per_pemicu p WHERE p."tabId" = t.id), 0) AS maks
FROM "form_tab" t
WHERE t.bobot IS NOT NULL;

UPDATE "form_item" i
SET score = ROUND((i.score * tm.bobot * 100 / tm.maks)::numeric, 4)
FROM "form_section" s, _tab_maks tm
WHERE s.id = i."sectionId" AND tm."tabId" = s."tabId" AND tm.maks > 0 AND i.score IS NOT NULL;

UPDATE "form_item_option" o
SET score = ROUND((o.score * tm.bobot * 100 / tm.maks)::numeric, 4)
FROM "form_item" i, "form_section" s, _tab_maks tm
WHERE i.id = o."itemId" AND s.id = i."sectionId" AND tm."tabId" = s."tabId"
  AND tm.maks > 0 AND o.score IS NOT NULL;

DROP TABLE _tab_maks;
