-- Format paket baru: saldo proyek, satker/lokasi RO/volume/tahun/lokasi per
-- paket, banyak Indikator RO per paket, bagian Pemaketan per paket.
ALTER TABLE "proyek"
    ADD COLUMN "saldoAnggaran" DECIMAL(16,0),
    ADD COLUMN "saldoVolumeRo" DECIMAL(14,4),
    ADD COLUMN "saldoVolumeIro" DECIMAL(14,4),
    ADD COLUMN "satkerBolehUbahPaket" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "paket"
    ALTER COLUMN "jenis" DROP NOT NULL,
    ALTER COLUMN "masaPelaksanaan" DROP NOT NULL,
    ADD COLUMN "satkerId" TEXT,
    ADD COLUMN "lokasiRo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "volumeRo" DECIMAL(14,4),
    ADD COLUMN "tahunMulai" SMALLINT,
    ADD COLUMN "tahunSelesai" SMALLINT,
    ADD COLUMN "lokasiSamaProyek" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "tipeKoordinat" "TipeKoordinat",
    ADD COLUMN "latitude" DOUBLE PRECISION,
    ADD COLUMN "longitude" DOUBLE PRECISION,
    ADD COLUMN "coordinates" JSONB;
ALTER TABLE "paket" ADD CONSTRAINT "paket_satkerId_fkey" FOREIGN KEY ("satkerId")
    REFERENCES "satker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "paket_indikator_ro" (
    "id" TEXT NOT NULL,
    "paketId" TEXT NOT NULL,
    "indikatorRoId" TEXT NOT NULL,
    "volume" DECIMAL(14,4),
    "satuan" VARCHAR(50),
    "order" SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT "paket_indikator_ro_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "paket_indikator_ro_paketId_idx" ON "paket_indikator_ro"("paketId");
ALTER TABLE "paket_indikator_ro" ADD CONSTRAINT "paket_indikator_ro_paketId_fkey"
    FOREIGN KEY ("paketId") REFERENCES "paket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paket_indikator_ro" ADD CONSTRAINT "paket_indikator_ro_indikatorRoId_fkey"
    FOREIGN KEY ("indikatorRoId") REFERENCES "indikator_ro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Volume per tahun (alokasi RENCANA) -> sekali per paket (dijumlah);
-- rentang tahun dari alokasi RENCANA yang ada.
UPDATE "paket" p SET
    "volumeRo" = s.vol,
    "tahunMulai" = s.mulai,
    "tahunSelesai" = s.selesai
FROM (
    SELECT "paketId", SUM("outputTarget") AS vol, MIN("tahun") AS mulai, MAX("tahun") AS selesai
    FROM "alokasi" WHERE "status" = 'RENCANA' GROUP BY "paketId"
) s
WHERE s."paketId" = p."id";

INSERT INTO "paket_indikator_ro" ("id", "paketId", "indikatorRoId", "volume", "satuan")
SELECT 'pir_' || p."id", p."id", p."indikatorRoId",
    (SELECT SUM(a."outcomeTarget") FROM "alokasi" a WHERE a."paketId" = p."id" AND a."status" = 'RENCANA'),
    (SELECT MAX(a."outcomeUnit") FROM "alokasi" a WHERE a."paketId" = p."id" AND a."status" = 'RENCANA')
FROM "paket" p WHERE p."indikatorRoId" IS NOT NULL;

ALTER TABLE "paket" DROP CONSTRAINT IF EXISTS "paket_indikatorRoId_fkey";
ALTER TABLE "paket" DROP COLUMN "indikatorRoId";

-- Bagian tab Pemaketan yang sudah ada = isian per paket.
ALTER TABLE "form_section" ADD COLUMN "perPaket" BOOLEAN NOT NULL DEFAULT false;
UPDATE "form_section" SET "perPaket" = true
WHERE "tabId" IN (SELECT "id" FROM "form_tab" WHERE "key" = 'pemaketan');

-- Field format lama dibuang dari form.
DELETE FROM "form_item" WHERE "key" IN ('paketJenis', 'paketMasa', 'paketDokLing');
