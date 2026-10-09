import { nilaiKondisi } from "./form-condition";

/**
 * Skor 1 field untuk badge di form — aturan SAMA dengan backend
 * src/proyek/form-skor.ts (yang menentukan skor tersimpan):
 * - Field ber-pilihan: pilihan yang dipilih DAN semua kolom tambahannya
 *   terisi. Centang = dijumlahkan, dropdown = skor pilihan terpilih.
 * - Field tanpa pilihan (teks, upload, centang tunggal): skor kalau terisi.
 * - Kolom tambahan tidak punya skor sendiri (score null).
 */
export interface ScoreItem {
  key: string;
  fieldType: string;
  score?: number | null;
  thresholdValue?: number | null;
  conditionItemId?: string | null;
  conditionValue?: string | null;
  options: { value: string; score?: number | null; isActive?: boolean }[];
}

export function terisi(raw: unknown): boolean {
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === "string") return raw.trim() !== "";
  return raw != null && raw !== false;
}

export function skorField(
  item: ScoreItem,
  lookup: (key: string) => unknown,
  kolomTambahan: ScoreItem[],
): { dapat: number; maks: number } {
  const opsi = item.options.filter((o) => o.isActive !== false);
  const multi = item.fieldType === "CHECKBOX";
  if (!opsi.length) {
    // Centang tunggal/field biasa: kolom tambahannya (muncul saat
    // dicentang, nilai "true") harus terisi dulu — sama dgn aturan pilihan.
    const s = item.score ?? 0;
    const dapat =
      terisi(lookup(item.key)) && pilihanLengkap("true", lookup, kolomTambahan) ? s : 0;
    return { dapat, maks: s };
  }
  const raw = lookup(item.key);
  const nilai = (Array.isArray(raw) ? raw : [raw]).map(String);
  let dapat = 0;
  for (const o of opsi) {
    if (!nilai.includes(o.value) || !pilihanLengkap(o.value, lookup, kolomTambahan))
      continue;
    const s = o.score ?? 0;
    dapat = multi ? dapat + s : Math.max(dapat, s);
  }
  const semua = opsi.map((o) => o.score ?? 0);
  return {
    dapat,
    maks: multi ? semua.reduce((a, b) => a + b, 0) : Math.max(0, ...semua),
  };
}

/** Semua kolom tambahan milik pilihan `value` sudah terisi. */
export function pilihanLengkap(
  value: string,
  lookup: (key: string) => unknown,
  kolomTambahan: ScoreItem[],
) {
  return kolomTambahan
    .filter((k) => nilaiKondisi(k.conditionValue).includes(value))
    .every((k) => terisi(lookup(k.key)));
}

/**
 * Bobot terpakai 1 tab (nilai tertinggi yang mungkin didapat) — SAMA
 * dengan backend form-skor.ts maksTab(): field tanpa syarat dijumlah;
 * field bersyarat per field pemicu diambil kelompok nilai terbesar.
 */
export function maksTab(items: (ScoreItem & { isActive?: boolean })[]): number {
  let total = 0;
  const perPemicu = new Map<string, Map<string, number>>();
  for (const i of items.filter((x) => x.isActive !== false)) {
    const m = skorField(i, () => undefined, []).maks;
    if (!i.conditionItemId) {
      total += m;
      continue;
    }
    const grup = perPemicu.get(i.conditionItemId) ?? new Map<string, number>();
    for (const v of nilaiKondisi(i.conditionValue)) grup.set(v, (grup.get(v) ?? 0) + m);
    perPemicu.set(i.conditionItemId, grup);
  }
  for (const grup of perPemicu.values()) total += Math.max(0, ...grup.values());
  return total;
}

/** Angka bobot/skor gaya Indonesia, maks 2 desimal (2,73). */
export const fmtSkor = (n: number) =>
  // "|| 0" buang -0 dari sisa pembulatan (15,0003 - 15).
  (Math.round(n * 100) / 100 || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  });

// ===== Rasio Valuasi (field tipe RASIO) — SAMA dengan backend
// src/proyek/form-skor.ts. A/B/C = total semua paket (alokasi RENCANA). =====
export interface RasioConfig {
  pembilang?: string;
  penyebut?: string;
  operator?: string;
  satuan?: string;
}
export interface RingkasPaket {
  A: number;
  B: number;
  C: number;
  satuanB: string[];
  satuanC: string[];
}
export const SUMBER_RASIO: Record<string, string> = {
  A: "Total anggaran",
  B: "Total volume RO",
  C: "Total volume Indikator RO",
};
export const OPERATOR_RASIO = ["<", "<=", ">", ">=", "="] as const;
export const SIMBOL_OPERATOR: Record<string, string> = {
  "<": "<",
  "<=": "≤",
  ">": ">",
  ">=": "≥",
  "=": "=",
};
export const SATUAN_RP: Record<string, { skala: number; label: string; ringkas: string }> = {
  rp: { skala: 1, label: "Rupiah", ringkas: "Rp" },
  ribu: { skala: 1e3, label: "ribu Rupiah", ringkas: "rb" },
  juta: { skala: 1e6, label: "juta Rupiah", ringkas: "jt" },
  miliar: { skala: 1e9, label: "miliar Rupiah", ringkas: "M" },
};

export function bandingkan(nilai: number, operator: string, standar: number) {
  switch (operator) {
    case "<=": return nilai <= standar;
    case ">": return nilai > standar;
    case ">=": return nilai >= standar;
    case "=": return Math.abs(nilai - standar) < 1e-9;
    default: return nilai < standar;
  }
}

export function ringkasPaket(
  alokasi: {
    status?: string | null;
    total?: unknown;
    outputTarget?: unknown;
    outputUnit?: string | null;
    outcomeTarget?: unknown;
    outcomeUnit?: string | null;
  }[],
): RingkasPaket {
  const rencana = alokasi.filter((a) => !a.status || a.status === "RENCANA");
  const unik = (xs: (string | null | undefined)[]) =>
    [...new Set(xs.map((x) => x?.trim()).filter((x): x is string => !!x))];
  return {
    A: rencana.reduce((s, a) => s + Number(a.total ?? 0), 0),
    B: rencana.reduce((s, a) => s + Number(a.outputTarget ?? 0), 0),
    C: rencana.reduce((s, a) => s + Number(a.outcomeTarget ?? 0), 0),
    satuanB: unik(rencana.map((a) => a.outputUnit)),
    satuanC: unik(rencana.map((a) => a.outcomeUnit)),
  };
}

export function hitungRasio(cfg: RasioConfig | null | undefined, r: RingkasPaket) {
  if (!cfg?.pembilang || !cfg.penyebut) return null;
  const skala = SATUAN_RP[cfg.satuan ?? "juta"]?.skala ?? 1e6;
  const nilai = (h: string): number | null =>
    h === "A" ? r.A / skala
    : h === "B" ? (r.satuanB.length > 1 ? null : r.B)
    : h === "C" ? (r.satuanC.length > 1 ? null : r.C)
    : null;
  const atas = nilai(cfg.pembilang);
  const bawah = nilai(cfg.penyebut);
  // Angka yang belum terisi (0) = belum bisa dihitung, bukan "lolos".
  if (atas == null || bawah == null || atas === 0 || bawah === 0) return null;
  return atas / bawah;
}

/** Rupiah diringkas utk dibaca: 3,6 M / 18 jt / 250 rb. */
export function fmtRupiahRingkas(n: number) {
  const a = Math.abs(n);
  if (a >= 1e9) return `${fmtSkor(n / 1e9)} M`;
  if (a >= 1e6) return `${fmtSkor(n / 1e6)} jt`;
  if (a >= 1e3) return `${fmtSkor(n / 1e3)} rb`;
  return fmtSkor(n);
}

/**
 * Teks rasio utk form: "3,6 M : 200 meter = 18 jt / meter" + status vs
 * standar. `pesan` terisi kalau belum bisa dihitung.
 */
export function teksRasio(
  cfg: RasioConfig | null | undefined,
  standar: number | null | undefined,
  r: RingkasPaket,
) {
  const sat = SATUAN_RP[cfg?.satuan ?? "juta"] ?? SATUAN_RP.juta;
  const unit = (h?: string) =>
    h === "A" ? sat.ringkas
    : h === "B" ? (r.satuanB[0] ?? "satuan RO")
    : (r.satuanC[0] ?? "satuan IRO");
  const tampil = (h?: string) =>
    h === "A" ? fmtRupiahRingkas(r.A)
    : `${fmtSkor(h === "B" ? r.B : r.C)} ${unit(h)}`.trim();
  const satuanHasil = `${unit(cfg?.pembilang)} / ${unit(cfg?.penyebut)}`;
  const syarat =
    standar != null
      ? `${SIMBOL_OPERATOR[cfg?.operator ?? "<"] ?? "<"} ${fmtSkor(standar)} ${satuanHasil}`.trim()
      : "";
  const campur = (h?: string) =>
    (h === "B" && r.satuanB.length > 1 && r.satuanB) ||
    (h === "C" && r.satuanC.length > 1 && r.satuanC) ||
    null;
  const satuanCampur = campur(cfg?.pembilang) || campur(cfg?.penyebut);
  if (!r.A && !r.B && !r.C)
    return { syarat, pesan: "Belum ada data paket — dihitung otomatis setelah paket diisi." };
  if (satuanCampur)
    return {
      syarat,
      pesan: `Volume memakai satuan berbeda (${satuanCampur.join(", ")}) sehingga tidak bisa dijumlah. Bobot rasio ini tidak masuk sampai satuannya seragam.`,
    };
  const v = hitungRasio(cfg, r);
  if (v == null) {
    const nol = [cfg?.pembilang, cfg?.penyebut].find(
      (h) => (h === "A" ? r.A : h === "B" ? r.B : r.C) === 0,
    );
    return {
      syarat,
      pesan: `${SUMBER_RASIO[nol ?? ""] ?? "Angka rasio"} masih 0 — rasio dihitung setelah diisi di paket.`,
    };
  }
  const hasilAngka = cfg?.pembilang === "A" ? fmtRupiahRingkas(v * sat.skala) : fmtSkor(v);
  const hasil =
    cfg?.pembilang === "A"
      ? `${hasilAngka} / ${unit(cfg?.penyebut)}`.trim()
      : `${hasilAngka} ${satuanHasil}`.trim();
  return {
    syarat,
    teks: `${tampil(cfg?.pembilang)} : ${tampil(cfg?.penyebut)} = ${hasil}`,
    terpenuhi: standar != null && bandingkan(v, cfg?.operator ?? "<", standar),
  };
}
