-- Field bersumber master yang dulu memakai SATU skor untuk semua baris
-- (form_item.score = "skor jika terisi") diubah jadi skor per baris
-- (form_item_option, value = nilai yang disimpan field), supaya setiap
-- pilihan menampilkan skornya sendiri. Nilai skornya disalin apa adanya,
-- jadi hasil penilaian untuk baris yang ada sekarang tidak berubah.
-- Baris master yang ditambah nanti mulai dengan skor kosong (= 0).

-- value opsi = nilai yang disimpan field; nama master (Sumber Usulan,
-- Tagging Dinamis) bisa sampai 255 karakter.
ALTER TABLE "form_item_option" ALTER COLUMN "value" TYPE VARCHAR(255);

INSERT INTO "form_item_option" ("id", "itemId", "value", "label", "order", "isActive", "score")
SELECT 'c' || substr(md5(random()::text || fi."id" || m."id"), 1, 24), fi."id", m."id", left(m."name", 255), 0, true, fi."score"
FROM "form_item" fi JOIN "pkpn" m ON true
WHERE fi."optionSource" = 'pkpn' AND fi."score" IS NOT NULL;

INSERT INTO "form_item_option" ("id", "itemId", "value", "label", "order", "isActive", "score")
SELECT 'c' || substr(md5(random()::text || fi."id" || m."id"), 1, 24), fi."id", m."id", left(m."name", 255), 0, true, fi."score"
FROM "form_item" fi JOIN "tematik_renja" m ON true
WHERE fi."optionSource" = 'tematikRenja' AND fi."score" IS NOT NULL;

INSERT INTO "form_item_option" ("id", "itemId", "value", "label", "order", "isActive", "score")
SELECT 'c' || substr(md5(random()::text || fi."id" || m."id"), 1, 24), fi."id", m."id", left(m."code" || ' — ' || m."name", 255), 0, true, fi."score"
FROM "form_item" fi JOIN "kegiatan_prioritas" m ON true
WHERE fi."optionSource" = 'kegiatanPrioritas' AND fi."score" IS NOT NULL;

INSERT INTO "form_item_option" ("id", "itemId", "value", "label", "order", "isActive", "score")
SELECT 'c' || substr(md5(random()::text || fi."id" || m."id"), 1, 24), fi."id", m."id", left(m."name", 255), 0, true, fi."score"
FROM "form_item" fi JOIN "indikator_sasaran_program" m ON true
WHERE fi."optionSource" = 'isp' AND fi."score" IS NOT NULL;

INSERT INTO "form_item_option" ("id", "itemId", "value", "label", "order", "isActive", "score")
SELECT 'c' || substr(md5(random()::text || fi."id" || m."id"), 1, 24), fi."id", m."id", left(m."name", 255), 0, true, fi."score"
FROM "form_item" fi JOIN "indikator_sasaran_kegiatan" m ON true
WHERE fi."optionSource" = 'isk' AND fi."score" IS NOT NULL;

-- Tagging Dinamis menyimpan NAMA (bukan id).
INSERT INTO "form_item_option" ("id", "itemId", "value", "label", "order", "isActive", "score")
SELECT 'c' || substr(md5(random()::text || fi."id" || m."id"), 1, 24), fi."id", m."name", left(m."name", 255), 0, true, fi."score"
FROM "form_item" fi JOIN "tagging_dinamis" m ON true
WHERE fi."optionSource" = 'taggingDinamis' AND fi."score" IS NOT NULL;

UPDATE "form_item" SET "score" = NULL
WHERE "optionSource" IN ('pkpn', 'tematikRenja', 'kegiatanPrioritas', 'isp', 'isk', 'taggingDinamis')
  AND "score" IS NOT NULL;
