-- Tipe field baru RASIO (dipisah dari migrasi yang memakainya karena
-- nilai enum baru belum bisa dipakai di transaksi yang sama).
ALTER TYPE "FormFieldType" ADD VALUE IF NOT EXISTS 'RASIO';
