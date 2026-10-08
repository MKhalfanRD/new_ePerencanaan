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
    const s = item.score ?? 0;
    return { dapat: terisi(lookup(item.key)) ? s : 0, maks: s };
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
