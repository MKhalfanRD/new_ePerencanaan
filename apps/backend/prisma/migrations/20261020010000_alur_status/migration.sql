-- Alur pemeriksaan: Draft -> Diajukan -> Diperiksa -> Disetujui, Dikembalikan.
ALTER TYPE "StatusProyek" ADD VALUE 'DIAJUKAN' BEFORE 'APPROVED';
ALTER TYPE "StatusProyek" ADD VALUE 'DIPERIKSA' BEFORE 'APPROVED';
ALTER TYPE "StatusProyek" ADD VALUE 'DIKEMBALIKAN' BEFORE 'APPROVED';

CREATE TYPE "AksiPemeriksaan" AS ENUM ('AJUKAN', 'SESUAI', 'REVISI', 'SETUJU', 'KEMBALIKAN');

CREATE TABLE "pemeriksaan_proyek" (
    "id" TEXT NOT NULL,
    "proyekId" TEXT NOT NULL,
    "aksi" "AksiPemeriksaan" NOT NULL,
    "catatan" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pemeriksaan_proyek_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pemeriksaan_proyek_proyekId_createdAt_idx" ON "pemeriksaan_proyek"("proyekId", "createdAt");
ALTER TABLE "pemeriksaan_proyek" ADD CONSTRAINT "pemeriksaan_proyek_proyekId_fkey" FOREIGN KEY ("proyekId") REFERENCES "proyek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pemeriksaan_proyek" ADD CONSTRAINT "pemeriksaan_proyek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
