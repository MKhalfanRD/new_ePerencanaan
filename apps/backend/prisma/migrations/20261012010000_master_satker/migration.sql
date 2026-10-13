-- Master Satker (satuan kerja) di bawah Balai.
CREATE TABLE "satker" (
    "id" TEXT NOT NULL,
    "balaiId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "satker_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "satker_balaiId_name_key" ON "satker"("balaiId", "name");
CREATE INDEX "satker_balaiId_idx" ON "satker"("balaiId");
ALTER TABLE "satker" ADD CONSTRAINT "satker_balaiId_fkey" FOREIGN KEY ("balaiId")
    REFERENCES "balai"("id") ON DELETE CASCADE ON UPDATE CASCADE;
