-- Baris REALISASI bernilai 0 yang dulu dibuat otomatis berpasangan dengan
-- RENCANA. Pemaketan kini cuma mengisi RENCANA; realisasi fitur terpisah.
-- Yang berisi angka, catatan, atau lokasi tetap dijaga.
DELETE FROM "alokasi" a
WHERE a."status" = 'REALISASI'
  AND a."total" = 0 AND a."rm" = 0 AND a."rmp" = 0 AND a."pln" = 0
  AND a."sbsn" = 0 AND a."kpbu" = 0
  AND COALESCE(a."outputTarget", 0) = 0 AND COALESCE(a."outcomeTarget", 0) = 0
  AND COALESCE(a."catatan", '') = ''
  AND NOT EXISTS (SELECT 1 FROM "lokasi_alokasi" l WHERE l."alokasiId" = a."id");
