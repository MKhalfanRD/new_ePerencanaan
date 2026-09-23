-- AlterTable dokumen_pendukung: tandai file sebagai jawaban field UPLOAD
-- tertentu di form dinamis (form_item), bukan cuma dokumen umum proyek.
ALTER TABLE "dokumen_pendukung" ADD COLUMN "formItemId" TEXT;

CREATE INDEX "dokumen_pendukung_formItemId_idx" ON "dokumen_pendukung"("formItemId");

ALTER TABLE "dokumen_pendukung"
    ADD CONSTRAINT "dokumen_pendukung_formItemId_fkey"
    FOREIGN KEY ("formItemId") REFERENCES "form_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
