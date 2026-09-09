-- Template izin yang dipinjam role turunan (lihat src/auth/role.ts).
-- Tanpa ini role baru dari UI ditolak semua @Roles() karena kodenya tidak
-- ada di dekorator mana pun.
ALTER TABLE "roles" ADD COLUMN     "baseRole" VARCHAR(50);
