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
