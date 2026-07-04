import type { DotColor } from "@/components/ui/badge";
export const statusConfig = {
  DRAFT: {
    label: "Draft",
    dotColor: "slate" as DotColor,
  },
  SUBMITTED: {
    label: "Menunggu Review",
    dotColor: "blue" as DotColor,
  },
  REVISION: {
    label: "Perlu Revisi",
    dotColor: "amber" as DotColor,
  },
  REJECTED: {
    label: "Ditolak",
    dotColor: "rose" as DotColor,
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
