-- Komponen & volume RO/IRO pindah dari sekali-per-paket ke per tahun
-- (baris alokasi RENCANA). 1 Indikator RO per paket.
ALTER TABLE "alokasi" ADD COLUMN "komponenId" TEXT;
ALTER TABLE "alokasi" ADD CONSTRAINT "alokasi_komponenId_fkey" FOREIGN KEY ("komponenId")
    REFERENCES "komponen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Komponen paket -> semua tahun RENCANA paket itu.
UPDATE "alokasi" a SET "komponenId" = p."komponenId"
FROM "paket" p
WHERE a."paketId" = p."id" AND a."status" = 'RENCANA' AND p."komponenId" IS NOT NULL;

-- Volume sekali-per-paket -> tahun pertama paket.
UPDATE "alokasi" a SET "outputTarget" = p."volumeRo"
FROM "paket" p
WHERE a."paketId" = p."id" AND a."status" = 'RENCANA' AND p."volumeRo" IS NOT NULL
  AND a."tahun" = (SELECT MIN(x."tahun") FROM "alokasi" x WHERE x."paketId" = p."id" AND x."status" = 'RENCANA');

DELETE FROM "paket_indikator_ro" i USING (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "paketId" ORDER BY "order", "id") AS n
    FROM "paket_indikator_ro"
) d
WHERE i."id" = d."id" AND d.n > 1;

UPDATE "alokasi" a SET "outcomeTarget" = i."volume"
FROM "paket_indikator_ro" i
WHERE a."paketId" = i."paketId" AND a."status" = 'RENCANA' AND i."volume" IS NOT NULL
  AND a."tahun" = (SELECT MIN(x."tahun") FROM "alokasi" x WHERE x."paketId" = i."paketId" AND x."status" = 'RENCANA');

ALTER TABLE "paket_indikator_ro" DROP COLUMN "volume";
ALTER TABLE "paket" DROP CONSTRAINT IF EXISTS "paket_komponenId_fkey";
ALTER TABLE "paket" DROP COLUMN "komponenId", DROP COLUMN "volumeRo";

-- Kanvas: komponen & volume RO jadi kolom di rincian per tahun.
DELETE FROM "form_item" WHERE "key" IN ('paketKomponen', 'paketVolumeRo');
UPDATE "form_item" SET "label" = 'Rincian per tahun' WHERE "key" = 'paketAlokasi' AND "label" = 'Alokasi anggaran';

-- Urutan field inti per paket: satker, nama, KRO/RO, IRO, tahun, rincian
-- per tahun, lokasi RO, lokasi paket; field lain di belakangnya.
UPDATE "form_item" SET "order" = "order" + 20
WHERE "sectionId" IN (SELECT "sectionId" FROM "form_item" WHERE "key" = 'paketName')
  AND "key" NOT IN ('paketSatker', 'paketName', 'paketRo', 'paketIndikatorRo', 'paketTahun',
                    'paketAlokasi', 'paketLokasiRo', 'paketLokasi');
UPDATE "form_item" SET "order" = CASE "key"
    WHEN 'paketSatker' THEN 0 WHEN 'paketName' THEN 1 WHEN 'paketRo' THEN 2
    WHEN 'paketIndikatorRo' THEN 3 WHEN 'paketTahun' THEN 4 WHEN 'paketAlokasi' THEN 5
    WHEN 'paketLokasiRo' THEN 6 WHEN 'paketLokasi' THEN 7 END
WHERE "key" IN ('paketSatker', 'paketName', 'paketRo', 'paketIndikatorRo', 'paketTahun',
                'paketAlokasi', 'paketLokasiRo', 'paketLokasi');

-- Saklar izin satker paling atas tab Pemaketan (bagian Saldo).
UPDATE "form_item" i SET "sectionId" = s."sectionId", "order" = -1
FROM "form_item" s
JOIN "form_section" sa ON sa."id" = s."sectionId"
JOIN "form_section" sb ON sb."tabId" = sa."tabId"
WHERE s."key" = 'saldoAnggaran' AND i."key" = 'satkerBolehUbahPaket' AND i."sectionId" = sb."id";
