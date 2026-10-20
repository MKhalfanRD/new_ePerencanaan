-- Saldo anggaran pindah dari per proyek ke per kegiatan per tahun.
CREATE TABLE "saldo_kegiatan" (
    "id" TEXT NOT NULL,
    "kegiatanId" VARCHAR(10) NOT NULL,
    "tahun" SMALLINT NOT NULL,
    "total" DECIMAL(16,0) NOT NULL,
    "rm" DECIMAL(16,0),
    "rmp" DECIMAL(16,0),
    "pln" DECIMAL(16,0),
    "sbsn" DECIMAL(16,0),
    "kpbu" DECIMAL(16,0),
    "alasan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "saldo_kegiatan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "saldo_kegiatan_kegiatanId_tahun_key" ON "saldo_kegiatan"("kegiatanId", "tahun");
ALTER TABLE "saldo_kegiatan" ADD CONSTRAINT "saldo_kegiatan_kegiatanId_fkey" FOREIGN KEY ("kegiatanId") REFERENCES "kegiatan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Kolom saldo anggaran per proyek (kosong di semua proyek per 20 Okt 2026).
ALTER TABLE "proyek" DROP COLUMN "saldoAnggaran";

-- Item form "Saldo anggaran" (field bawaan tab Pemaketan) ikut dihapus.
DELETE FROM "form_item" WHERE "key" = 'saldoAnggaran';
