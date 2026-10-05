-- "Sumber Usulan Lainnya" dulu muncul lewat aturan tertulis di kode (hanya
-- kalau Sumber Usulan = Pemda / K/L / Lainnya). Sekarang jadi kondisi
-- "Tampil jika" biasa (form_item.conditionItemId = KEY item pemicu,
-- conditionValue = JSON array nilai) supaya bisa diubah admin di kanvas.
UPDATE "form_item"
SET "conditionItemId" = 'sumberUsulanProyek',
    "conditionValue" = '["Pemerintah Daerah","Kementerian/Lembaga","Lainnya"]'
WHERE "key" = 'sumberUsulanLainnya' AND "conditionItemId" IS NULL;
