-- Riwayat proyek berlabel (menggantikan log aktivitas global untuk proyek).
CREATE TABLE "riwayat_proyek" (
    "id" TEXT NOT NULL,
    "proyekId" TEXT NOT NULL,
    "userId" TEXT,
    "aksi" VARCHAR(120) NOT NULL,
    "catatan" TEXT,
    "perubahan" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "riwayat_proyek_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "riwayat_proyek_proyekId_createdAt_idx" ON "riwayat_proyek"("proyekId", "createdAt");
ALTER TABLE "riwayat_proyek" ADD CONSTRAINT "riwayat_proyek_proyekId_fkey" FOREIGN KEY ("proyekId") REFERENCES "proyek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "riwayat_proyek" ADD CONSTRAINT "riwayat_proyek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
