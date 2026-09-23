/**
 * Skor evaluasi proyek dari struktur Form Proyek (Master Data), menggantikan
 * evaluasi-skor.ts + evaluasi-deteksi.ts (MetodeEvaluasi/EvaluasiItem).
 *
 * Rumus per tab persis yang lama: (score didapat / score maksimum item aktif
 * di tab) x bobot tab, dijumlah semua tab skoring. Bobot/score per-ITEM di
 * schema (FormItem.bobot/FormItemOption.bobot) murni informasi tampilan
 * (mirror kolom "bobot" di excel) — TIDAK dipakai di rumus ini, sama seperti
 * MetodeEvaluasi dulu (cuma bobot per tab yang menentukan, bukan per item).
 *
 * `lookup(key)` mengembalikan nilai isian proyek untuk sebuah FormItem.key:
 *   - Item BER-OPSI (dropdown): nilai dicocokkan ke `FormItemOption.value`
 *     (array of value diperbolehkan, dipakai untuk field multi seperti
 *     taggingDinamis) — diambil score opsi yang cocok.
 *   - Item TANPA opsi (checkbox tunggal): truthy/non-empty = score item itu.
 */
export interface ScoringOptionDef {
  value: string;
  score: number | null;
  isActive: boolean;
}
export interface ScoringItemDef {
  key: string;
  score: number | null;
  isActive: boolean;
  options: ScoringOptionDef[];
  // Khusus item rasio (tab Valuasi, tanpa opsi): "kena" kalau nilai dari
  // lookup(key) (angka rasio, BUKAN boolean) < thresholdValue — persis kolom
  // "Standar (S)" di sheet. Item tanpa opsi & tanpa threshold pakai truthy
  // check biasa (lihat nilaiItem).
  thresholdValue?: number | null;
}
export interface ScoringTabDef {
  bobot: number | null;
  items: ScoringItemDef[];
}
export type ItemValueLookup = (key: string) => unknown;

function nilaiItem(item: ScoringItemDef, lookup: ItemValueLookup): number {
  const raw = lookup(item.key);
  const activeOptions = item.options.filter((o) => o.isActive);
  if (activeOptions.length) {
    const nilai = Array.isArray(raw) ? raw : [raw];
    let skor = 0;
    for (const v of nilai) {
      const opt = activeOptions.find((o) => o.value === String(v));
      if (opt) skor = Math.max(skor, opt.score ?? 0);
    }
    return skor;
  }
  if (item.thresholdValue != null) {
    const angka = typeof raw === 'number' ? raw : Number(raw);
    return angka != null && !Number.isNaN(angka) && angka < item.thresholdValue
      ? (item.score ?? 0)
      : 0;
  }
  const terisi = Array.isArray(raw) ? raw.length > 0 : !!raw;
  return terisi ? (item.score ?? 0) : 0;
}

function maksItem(item: ScoringItemDef): number {
  const activeOptions = item.options.filter((o) => o.isActive);
  if (activeOptions.length) {
    return Math.max(0, ...activeOptions.map((o) => o.score ?? 0));
  }
  return item.score ?? 0;
}

export function hitungSkorEvaluasi(
  tabs: ScoringTabDef[],
  lookup: ItemValueLookup,
): number {
  let total = 0;
  for (const tab of tabs) {
    if (tab.bobot == null) continue;
    const items = tab.items.filter((i) => i.isActive);
    const maks = items.reduce((s, i) => s + maksItem(i), 0);
    if (maks <= 0) continue;
    const dapat = items.reduce((s, i) => s + nilaiItem(i, lookup), 0);
    total += (dapat / maks) * tab.bobot;
  }
  // 4 desimal — sama presisi kolom skorEvaluasi di schema.
  return Math.round(total * 10000) / 10000;
}

// Self-check — npx ts-node src/proyek/form-skor.ts
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { strictEqual }: { strictEqual: (a: unknown, b: unknown) => void } =
    require('assert');

  const dasar: ScoringTabDef = {
    bobot: 0.3,
    items: [
      { key: 'sumberUsulanProyek', score: null, isActive: true, options: [
        { value: 'Pemerintah Daerah', score: 1, isActive: true },
        { value: 'Kementerian/Lembaga', score: 2, isActive: true },
      ] },
    ],
  };
  const kesiapan: ScoringTabDef = {
    bobot: 0.25,
    items: [
      { key: 'statusDed', score: null, isActive: true, options: [
        { value: 'SUDAH_ADA', score: 2, isActive: true },
        { value: 'RENCANA', score: 0, isActive: true },
      ] },
      { key: 'kebutuhanTanah', score: 1, isActive: true, options: [] },
    ],
  };

  const lookupA: ItemValueLookup = (key) =>
    ({ sumberUsulanProyek: 'Kementerian/Lembaga', statusDed: 'SUDAH_ADA', kebutuhanTanah: false }[key]);
  // dasar: dapat 2 / maks 2 * 0.3 = 0.3 ; kesiapan: (2+0)/(2+1)*0.25 = 0.1667
  strictEqual(hitungSkorEvaluasi([dasar, kesiapan], lookupA), 0.4667);

  const lookupKosong: ItemValueLookup = () => undefined;
  strictEqual(hitungSkorEvaluasi([dasar, kesiapan], lookupKosong), 0);

  // Tab nonaktif/tanpa item aktif tidak boleh bikin NaN.
  strictEqual(hitungSkorEvaluasi([{ bobot: 0.2, items: [] }], lookupKosong), 0);
  strictEqual(hitungSkorEvaluasi([], lookupKosong), 0);

  console.log('form-skor OK');
}
