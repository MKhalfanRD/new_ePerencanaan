-- Master Kategori Proyek per kegiatan. Pilihan manual field
-- "kategoriProyek" dipindah ke master (kode = nilai lama, jadi syarat
-- bagian Valuasi/Kinerja & isian proyek lama tetap cocok).
CREATE TABLE "kategori_proyek" (
    "id" TEXT NOT NULL,
    "kegiatanId" VARCHAR(10) NOT NULL,
    "kode" VARCHAR(60) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kategori_proyek_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kategori_proyek_kegiatanId_kode_key" ON "kategori_proyek"("kegiatanId", "kode");
CREATE INDEX "kategori_proyek_kegiatanId_idx" ON "kategori_proyek"("kegiatanId");
ALTER TABLE "kategori_proyek" ADD CONSTRAINT "kategori_proyek_kegiatanId_fkey"
    FOREIGN KEY ("kegiatanId") REFERENCES "kegiatan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "kategori_proyek" ("id", "kegiatanId", "kode", "name", "order", "updatedAt")
SELECT 'kp_' || o.id, f."kegiatanId", o.value, o.label, o."order", CURRENT_TIMESTAMP
FROM "form_item_option" o
JOIN "form_item" i ON i.id = o."itemId"
JOIN "form_section" s ON s.id = i."sectionId"
JOIN "form_tab" t ON t.id = s."tabId"
JOIN "form_template" f ON f.id = t."templateId"
WHERE i.key = 'kategoriProyek'
ON CONFLICT DO NOTHING;

-- Isian proyek/paket yang menunjuk pilihan lama -> simpan sebagai kode.
UPDATE "proyek_form_value" v SET "valueText" = o.value, "optionId" = NULL
FROM "form_item_option" o JOIN "form_item" i ON i.id = o."itemId"
WHERE v."optionId" = o.id AND i.key = 'kategoriProyek';
UPDATE "paket_form_value" v SET "valueText" = o.value, "optionId" = NULL
FROM "form_item_option" o JOIN "form_item" i ON i.id = o."itemId"
WHERE v."optionId" = o.id AND i.key = 'kategoriProyek';

UPDATE "form_item" SET "optionSource" = 'kategoriProyek' WHERE key = 'kategoriProyek';
DELETE FROM "form_item_option" o USING "form_item" i
WHERE i.id = o."itemId" AND i.key = 'kategoriProyek';
