import type { LucideIcon } from "lucide-react";
import {
  MapPin,
  ScrollText,
  FileText,
  Tags,
  ClipboardCheck,
} from "lucide-react";

// Heuristik lebar field form dinamis, dipakai admin canvas (form-proyek-tab)
// dan form user asli (proyek-form-dialog) supaya keduanya selalu sinkron.
const WIDE_FIELD_TYPES = new Set(["FIELDBOX", "UPLOAD", "CHECKBOX"]);

// Slug tab tetap (form_tab.key) — satu-satunya sumber grid/icon/deskripsi
// default tab, dipakai admin canvas (form-proyek-tab) & form user asli
// (proyek-form-dialog) supaya keduanya selalu sinkron secara visual.
export type TabKey =
  | "identitas"
  | "dasar"
  | "kesiapan"
  | "tematik"
  | "pemaketan"
  | "valuasi"
  | "kinerja"
  | "dokumen"
  | "evaluasi";

// Grid item generik per tab (di luar field "baku" yang punya renderer sendiri).
export const TAB_GRID_CLASS: Partial<Record<TabKey, string>> = {
  identitas: "grid grid-cols-1 sm:grid-cols-2 gap-3",
  dasar: "grid grid-cols-1 sm:grid-cols-2 gap-3",
  kesiapan: "grid grid-cols-2 md:grid-cols-4 gap-3",
  tematik: "grid grid-cols-1 sm:grid-cols-2 gap-3",
  valuasi: "grid grid-cols-1 sm:grid-cols-2 gap-3",
  kinerja: "grid grid-cols-1 gap-3",
  dokumen: "grid grid-cols-1 gap-3",
};

// Wrapper grid field "Kegiatan" (bukan FormItem, posisinya tetap di kedua form).
export const KEGIATAN_GRID_CLASS = "grid grid-cols-2 gap-5";

export const TAB_ICONS: Record<TabKey, LucideIcon> = {
  identitas: MapPin,
  dasar: ScrollText,
  kesiapan: FileText,
  tematik: Tags,
  pemaketan: Tags,
  valuasi: ClipboardCheck,
  kinerja: ClipboardCheck,
  dokumen: FileText,
  evaluasi: ClipboardCheck,
};

// Subjudul default tab di form "Buat Proyek" — dipakai kalau admin belum
// isi FormTab.description di master.
export const TAB_DEFAULT_DESCRIPTIONS: Record<TabKey, string> = {
  identitas: "Informasi dasar mengenai proyek dan unit pelaksana",
  dasar:
    "Sumber usulan dan justifikasi proyek — dipakai skor evaluasi tab Dasar Pelaksanaan/Kesiapan Teknis",
  kesiapan:
    "Kesiapan dokumen teknis — dipakai skor evaluasi tab Dasar Pelaksanaan/Kesiapan Teknis",
  tematik: "RPJMN, RENSTRA, RENJA, PKPN, dan tagging lainnya",
  pemaketan: "Paket pekerjaan proyek ini",
  valuasi: "Kategori proyek menentukan kriteria valuasi & kinerja yang berlaku",
  kinerja: "Centang kriteria kinerja yang terpenuhi proyek ini",
  dokumen: "Dokumen pendukung dan catatan pembina/SSPSDA",
  evaluasi:
    "Skor dihitung otomatis dari isian tab Dasar Pelaksanaan, Kesiapan Teknis, Tematik, Valuasi, dan Kinerja",
};

export const WIDTH_LABEL: Record<string, string> = {
  AUTO: "Otomatis",
  HALF: "Setengah",
  FULL: "Penuh",
};

export interface WidthAwareItem {
  fieldType: string;
  thresholdValue?: number | null;
  width?: "HALF" | "FULL" | null;
}

export function isItemWide(item: WidthAwareItem): boolean {
  return item.width === "FULL"
    ? true
    : item.width === "HALF"
      ? false
      : WIDE_FIELD_TYPES.has(item.fieldType) || item.thresholdValue != null;
}
