-- Field & bagian baru dulu selalu dibuat dengan order 0, jadi banyak nomor
-- urut kembar dan urutannya "lompat" sendiri tiap dimuat ulang. Nomori ulang
-- 0,1,2,... per bagian/tab mengikuti urutan yang tampil sekarang
-- (order lalu id).
UPDATE "form_item" fi SET "order" = x.rn
FROM (
  SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "sectionId" ORDER BY "order", "id") - 1)::smallint AS rn
  FROM "form_item"
) x
WHERE fi."id" = x."id" AND fi."order" <> x.rn;

UPDATE "form_section" fs SET "order" = x.rn
FROM (
  SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "tabId" ORDER BY "order", "id") - 1)::smallint AS rn
  FROM "form_section"
) x
WHERE fs."id" = x."id" AND fs."order" <> x.rn;
