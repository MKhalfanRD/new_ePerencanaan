import type { Proyek, User } from "@/types";
import { punyaRole } from "@/lib/role";

/**
 * Alur status proyek (docs-planning/flowchart-alur-status.pdf), sama dengan
 * backend/src/proyek/alur-status.ts: isi proyek & paket dikunci selama
 * Diajukan / Diperiksa / Disetujui.
 */
export const STATUS_TERKUNCI: Proyek["status"][] = ["DIAJUKAN", "DIPERIKSA", "APPROVED"];
export const terkunci = (status: Proyek["status"]) => STATUS_TERKUNCI.includes(status);
export const bisaDiajukan = (status: Proyek["status"]) => status === "DRAFT" || status === "DIKEMBALIKAN";

type Akun = Pick<User, "role" | "baseRole"> | null | undefined;
export const adalahAdmin = (u: Akun) => punyaRole(u, "ADMINISTRATOR");
export const adalahPemeriksa = (u: Akun) => punyaRole(u, "VERIFICATOR", "OPERATOR");
export const adalahPengisi = (u: Akun) => punyaRole(u, "SATKER", "ADMINISTRATOR");

export type AksiPemeriksaan = "AJUKAN" | "SESUAI" | "REVISI" | "SETUJU" | "KEMBALIKAN";
export interface JejakPemeriksaan {
  aksi: AksiPemeriksaan;
  catatan: string | null;
  createdAt: string;
  user: { name: string; role?: { name: string } | null };
}
export const LABEL_AKSI: Record<AksiPemeriksaan, string> = {
  AJUKAN: "Diajukan",
  SESUAI: "Sesuai",
  REVISI: "Perlu revisi",
  SETUJU: "Disetujui",
  KEMBALIKAN: "Dikembalikan",
};
export const waktuSingkat = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
