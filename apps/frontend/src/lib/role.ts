import type { User } from "@/types";

/**
 * Izin di UI dicek dari kode role. Role turunan yang dibuat lewat halaman
 * Pengguna — mis. `OPERATOR_7691` — meminjam izin dari `baseRole`-nya
 * (`SATKER`), sama seperti RolesGuard di backend (lihat
 * `apps/backend/src/auth/role.ts`). Cek langsung `user.role === "SATKER"`
 * akan melewatkan role-role itu, jadi selalu pakai helper ini.
 */
export const punyaRole = (
  user: Pick<User, "role" | "baseRole"> | null | undefined,
  ...kode: string[]
): boolean => {
  if (!user) return false;
  // SUPER_ADMIN lolos semua, konsisten dengan RolesGuard.
  if (user.role === "SUPER_ADMIN") return true;
  return kode.includes(user.role) || kode.includes(user.baseRole ?? "");
};
