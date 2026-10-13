-- Balai terikat ke 1 kegiatan; akun pengguna bisa milik satker.
ALTER TABLE "balai" ADD COLUMN "kegiatanId" VARCHAR(10);
ALTER TABLE "balai" ADD CONSTRAINT "balai_kegiatanId_fkey" FOREIGN KEY ("kegiatanId")
    REFERENCES "kegiatan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD COLUMN "satkerId" TEXT;
ALTER TABLE "users" ADD CONSTRAINT "users_satkerId_fkey" FOREIGN KEY ("satkerId")
    REFERENCES "satker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
