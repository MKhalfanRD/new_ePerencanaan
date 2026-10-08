-- Sumber pilihan bertingkat: field yang pilihannya disaring dari field
-- induk (mis. Satuan RO mengikuti field RO). Null = tanpa induk.
ALTER TABLE "form_item" ADD COLUMN "optionParentKey" VARCHAR(100);
