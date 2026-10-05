-- Tab Pemaketan jadi dinamis: field paket = item template di tab
-- "pemaketan"; isian field custom per paket disimpan di paket_form_value
-- (setara proyek_form_value, tapi per paket karena 1 proyek bisa banyak paket).

CREATE TABLE "paket_form_value" (
    "id" TEXT NOT NULL,
    "paketId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "optionId" TEXT,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paket_form_value_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "paket_form_value_paketId_itemId_key" ON "paket_form_value"("paketId", "itemId");
CREATE INDEX "paket_form_value_itemId_idx" ON "paket_form_value"("itemId");

ALTER TABLE "paket_form_value" ADD CONSTRAINT "paket_form_value_paketId_fkey" FOREIGN KEY ("paketId") REFERENCES "paket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paket_form_value" ADD CONSTRAINT "paket_form_value_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "form_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paket_form_value" ADD CONSTRAINT "paket_form_value_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "form_item_option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Field baku paket untuk tab Pemaketan yang belum punya section (semua
-- template lama — tab ini dulu sengaja kosong).
DO $$
DECLARE
  t RECORD;
  sid TEXT;
BEGIN
  FOR t IN
    SELECT ft."id" FROM "form_tab" ft
    WHERE ft."key" = 'pemaketan'
      AND NOT EXISTS (SELECT 1 FROM "form_section" s WHERE s."tabId" = ft."id")
  LOOP
    sid := 'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24);
    INSERT INTO "form_section" ("id", "tabId", "key", "label", "order", "isActive")
    VALUES (sid, t."id", 'data-paket', 'Data Paket', 0, true);

    INSERT INTO "form_item" ("id", "sectionId", "key", "label", "fieldType", "order", "isActive", "required", "width")
    SELECT 'c' || substr(md5(random()::text || clock_timestamp()::text || v.key), 1, 24),
           sid, v.key, v.label, v.ft::"FormFieldType", v.ord, true, v.req, v.w::"FormFieldWidth"
    FROM (VALUES
      ('paketName',        'Nama Paket',                  'TEXT',     0, true,  'FULL'),
      ('paketRo',          'RO (Rincian Output)',         'DROPDOWN', 1, true,  'FULL'),
      ('paketKomponen',    'Komponen',                    'DROPDOWN', 2, false, 'HALF'),
      ('paketIndikatorRo', 'Indikator RO (IRO)',          'DROPDOWN', 3, false, 'HALF'),
      ('paketJenis',       'Jenis Paket',                 'DROPDOWN', 4, false, 'HALF'),
      ('paketMasa',        'Masa Pelaksanaan',            'DROPDOWN', 5, false, 'HALF'),
      ('paketDokLing',     'Dokumen Lingkungan (status)', 'TEXT',     6, false, 'FULL')
    ) AS v(key, label, ft, ord, req, w);
  END LOOP;
END $$;
