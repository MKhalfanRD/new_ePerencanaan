-- Rename sisa index/FK constraint yang masih memakai nama "plannings"/
-- "planningId" lama, murni kosmetik (tidak mengubah data) — supaya
-- `prisma migrate diff` bersih ke depannya.

ALTER INDEX "paket_planningId_idx" RENAME TO "paket_proyekId_idx";

ALTER TABLE "proyek" RENAME CONSTRAINT "plannings_kegiatanPrioritasId_fkey" TO "proyek_kegiatanPrioritasId_fkey";
ALTER TABLE "proyek" RENAME CONSTRAINT "plannings_wilayahSungaiId_fkey" TO "proyek_wilayahSungaiId_fkey";

ALTER INDEX "plannings_balaiId_idx" RENAME TO "proyek_balaiId_idx";
ALTER INDEX "plannings_createdById_idx" RENAME TO "proyek_createdById_idx";
ALTER INDEX "plannings_kodeProyek_key" RENAME TO "proyek_kodeProyek_key";
ALTER INDEX "plannings_periodeId_idx" RENAME TO "proyek_periodeId_idx";
ALTER INDEX "plannings_status_idx" RENAME TO "proyek_status_idx";
