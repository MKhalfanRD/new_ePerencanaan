-- Penanda komponen utama/pendukung. Semua komponen lama = UTAMA supaya
-- hasil rasio Valuasi yang ada tidak berubah sampai admin menandainya.
ALTER TABLE "komponen" ADD COLUMN "jenis" VARCHAR(10) NOT NULL DEFAULT 'UTAMA';
