import type { DotColor } from "@/components/ui/badge";
export const statusConfig = {
  DRAFT: {
    label: "Draft",
    dotColor: "slate" as DotColor,
  },
  APPROVED: {
    label: "Disetujui",
    dotColor: "emerald" as DotColor,
  },
} satisfies Record<string, { label: string; dotColor: DotColor }>;

export type PlanningStatus = keyof typeof statusConfig;

export const dokumenStatusConfig = {
  TIDAK_PERLU: {
    label: "Tidak Perlu",
    dotColor: "slate" as DotColor,
  },
  BELUM_ADA: {
    label: "Belum Ada",
    dotColor: "rose" as DotColor,
  },
  SUDAH_ADA: {
    label: "Sudah Ada",
    dotColor: "emerald" as DotColor,
  },
} satisfies Record<string, { label: string; dotColor: DotColor }>;

export type DokumenStatus = keyof typeof dokumenStatusConfig;

export const alokasiStatusConfig = {
  RENCANA: {
    label: "Rencana",
    dotColor: "blue" as DotColor,
  },
  REALISASI: {
    label: "Realisasi",
    dotColor: "emerald" as DotColor,
  },
} satisfies Record<string, { label: string; dotColor: DotColor }>;

export type AlokasiStatus = keyof typeof alokasiStatusConfig;

/**
 * Penilaian realisasi terhadap rencananya. Hijau + centang HANYA kalau ada
 * realisasi dan nilainya tidak melebihi rencana — realisasi yang melebihi
 * rencana itu over-budget, bukan "sukses", jadi merah tanpa centang.
 * Dipakai bareng di daftar proyek & drawer detail supaya aturannya satu,
 * bukan dua salinan yang gampang beda.
 */
export const nilaiRealisasi = (realisasi: number, rencana: number) => {
  const over = realisasi > rencana;
  return {
    over,
    checked: realisasi > 0 && !over,
    className:
      realisasi <= 0
        ? "text-muted-foreground"
        : over
          ? "text-red-600"
          : "text-emerald-600",
  };
};
