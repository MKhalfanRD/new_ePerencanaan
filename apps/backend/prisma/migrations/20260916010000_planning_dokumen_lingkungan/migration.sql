-- Dokumen Lingkungan sekarang juga jadi bagian "Tahapan Dokumen" di form
-- Proyek (sejajar Studi Kelayakan/DED/LARAP) — tahun penyelesaian, bukan
-- status bebas seperti Paket.dokLingStatus (konsep beda level).
ALTER TABLE "plannings" ADD COLUMN "tahunDokumenLingkungan" SMALLINT;
