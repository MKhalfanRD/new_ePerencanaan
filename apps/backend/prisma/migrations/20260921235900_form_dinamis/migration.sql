-- Tabel form dinamis + kolom wilayah yang dulu cuma masuk lewat `db push`
-- (tidak pernah ada migrasinya). Harus jalan sebelum
-- 20260922000000_dokumen_pendukung_form_item yang FK ke form_item.
-- form_tab.description & dokumen_pendukung.formItemId sengaja tidak di sini,
-- sudah ditambah oleh migrasi berikutnya.

-- CreateEnum
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'CHECKBOX', 'FIELDBOX', 'UPLOAD');
CREATE TYPE "FormFieldWidth" AS ENUM ('HALF', 'FULL');

-- CreateTable
CREATE TABLE "form_template" (
    "id" TEXT NOT NULL,
    "kegiatanId" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_tab" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bobot" DOUBLE PRECISION,

    CONSTRAINT "form_tab_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_section" (
    "id" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "form_section_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_item" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "FormFieldType" NOT NULL,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "width" "FormFieldWidth",
    "score" SMALLINT,
    "bobot" DOUBLE PRECISION,
    "thresholdValue" DOUBLE PRECISION,
    "conditionItemId" TEXT,
    "conditionValue" TEXT,

    CONSTRAINT "form_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_item_option" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "value" VARCHAR(100) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "score" SMALLINT,
    "bobot" DOUBLE PRECISION,

    CONSTRAINT "form_item_option_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proyek_form_value" (
    "id" TEXT NOT NULL,
    "proyekId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "optionId" TEXT,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyek_form_value_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "form_template_kegiatanId_key" ON "form_template"("kegiatanId");
CREATE UNIQUE INDEX "form_tab_templateId_key_key" ON "form_tab"("templateId", "key");
CREATE INDEX "proyek_form_value_itemId_idx" ON "proyek_form_value"("itemId");
CREATE UNIQUE INDEX "proyek_form_value_proyekId_itemId_key" ON "proyek_form_value"("proyekId", "itemId");

-- AddForeignKey
ALTER TABLE "form_template" ADD CONSTRAINT "form_template_kegiatanId_fkey" FOREIGN KEY ("kegiatanId") REFERENCES "kegiatan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "form_tab" ADD CONSTRAINT "form_tab_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "form_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_section" ADD CONSTRAINT "form_section_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "form_tab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_item" ADD CONSTRAINT "form_item_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "form_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_item_option" ADD CONSTRAINT "form_item_option_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "form_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyek_form_value" ADD CONSTRAINT "proyek_form_value_proyekId_fkey" FOREIGN KEY ("proyekId") REFERENCES "proyek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyek_form_value" ADD CONSTRAINT "proyek_form_value_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "form_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyek_form_value" ADD CONSTRAINT "proyek_form_value_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "form_item_option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Kolom wilayah (IF NOT EXISTS: server mungkin sudah sempat di-db-push)
ALTER TABLE "wilayah_provinces" ADD COLUMN IF NOT EXISTS "kodeReferensi" VARCHAR(10);
ALTER TABLE "wilayah_regencies" ADD COLUMN IF NOT EXISTS "kodeReferensi" VARCHAR(10);
ALTER TABLE "wilayah_districts" ADD COLUMN IF NOT EXISTS "kodeReferensi" VARCHAR(10);
ALTER TABLE "wilayah_sungai" ADD COLUMN IF NOT EXISTS "code" VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS "wilayah_provinces_kodeReferensi_key" ON "wilayah_provinces"("kodeReferensi");
CREATE UNIQUE INDEX IF NOT EXISTS "wilayah_regencies_kodeReferensi_key" ON "wilayah_regencies"("kodeReferensi");
CREATE UNIQUE INDEX IF NOT EXISTS "wilayah_districts_kodeReferensi_key" ON "wilayah_districts"("kodeReferensi");
CREATE UNIQUE INDEX IF NOT EXISTS "wilayah_sungai_code_key" ON "wilayah_sungai"("code");
