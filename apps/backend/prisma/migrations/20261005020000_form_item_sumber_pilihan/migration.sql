-- Sumber pilihan per field (manual / tabel master) + label bagian dalam
-- field gabungan, supaya semuanya bisa diatur dari kanvas Form Proyek.
ALTER TABLE "form_item" ADD COLUMN "optionSource" VARCHAR(50),
ADD COLUMN "subLabels" JSONB;

-- Field bawaan yang memang mengambil pilihan dari master.
UPDATE "form_item" SET "optionSource" = CASE "key"
  WHEN 'balaiId' THEN 'balai'
  WHEN 'periodeId' THEN 'periode'
  WHEN 'wilayahSungaiId' THEN 'wilayahSungai'
  WHEN 'sumberUsulanProyek' THEN 'sumberUsulan'
  WHEN 'kegiatanPrioritasId' THEN 'kegiatanPrioritas'
  WHEN 'indikatorSasaranProgramId' THEN 'isp'
  WHEN 'indikatorSasaranKegiatanId' THEN 'isk'
  WHEN 'tematikRenjaId' THEN 'tematikRenja'
  WHEN 'pkpnId' THEN 'pkpn'
  WHEN 'taggingDinamis' THEN 'taggingDinamis'
  WHEN 'provinceId' THEN 'wilayah'
END
WHERE "key" IN ('balaiId', 'periodeId', 'wilayahSungaiId', 'sumberUsulanProyek',
  'kegiatanPrioritasId', 'indikatorSasaranProgramId', 'indikatorSasaranKegiatanId',
  'tematikRenjaId', 'pkpnId', 'taggingDinamis', 'provinceId');

-- Tipe field bawaan disamakan dengan bentuk aslinya di form: pilihan
-- tunggal dari master = Dropdown (sebelumnya tercatat Checkbox).
UPDATE "form_item" SET "fieldType" = 'DROPDOWN'
WHERE "key" IN ('kegiatanPrioritasId', 'indikatorSasaranProgramId',
  'indikatorSasaranKegiatanId', 'tematikRenjaId', 'pkpnId');
