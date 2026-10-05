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
/**
 * Field kondisional ("Tampil jika" di kanvas Form Proyek): FormItem
 * conditionItemId = KEY item pemicu, conditionValue = satu nilai atau JSON
 * array nilai. Terpenuhi kalau nilai pemicu (atau salah satu isi array,
 * utk checkbox multi-pilih) ada di daftar itu. Sama persis dengan
 * frontend lib/form-condition.ts.
 */
export function nilaiKondisi(conditionValue: string | null | undefined): string[] {
  if (!conditionValue) return [];
  if (conditionValue.startsWith('[')) {
    try {
      return (JSON.parse(conditionValue) as unknown[]).map(String);
    } catch {
      // bukan JSON — anggap satu nilai biasa
    }
  }
  return [conditionValue];
}
export function kondisiTerpenuhi(
  conditionValue: string | null | undefined,
  raw: unknown,
): boolean {
  const target = nilaiKondisi(conditionValue);
  const nilai = Array.isArray(raw) ? raw : [raw];
  return nilai.some((v) => v != null && v !== '' && target.includes(String(v)));
}

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
  // CHECKBOX ber-opsi = multi-pilih: skor pilihan dijumlahkan.
  fieldType?: string;
  // Kolom tambahan: anak dari pilihan item lain (lihat kondisiTerpenuhi).
  conditionItemId?: string | null;
  conditionValue?: string | null;
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

/** Field dianggap terisi: teks tidak kosong, array tidak kosong, true. */
export function terisi(raw: unknown): boolean {
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === 'string') return raw.trim() !== '';
  return raw != null && raw !== false;
}

const isMulti = (item: ScoringItemDef) => item.fieldType === 'CHECKBOX';

/**
 * Skor 1 item ber-pilihan: pilihan yang dipilih DAN semua kolom
 * tambahannya (`anak`) sudah terisi. Centang multi = dijumlahkan,
 * dropdown = skor pilihan terpilih. Pilihan tanpa skor = 0.
 */
function nilaiItem(
  item: ScoringItemDef,
  lookup: ItemValueLookup,
  anak: ScoringItemDef[],
): number {
  const raw = lookup(item.key);
  const activeOptions = item.options.filter((o) => o.isActive);
  if (activeOptions.length) {
    const nilai = (Array.isArray(raw) ? raw : [raw]).map(String);
    let skor = 0;
    for (const opt of activeOptions) {
      if (!nilai.includes(opt.value)) continue;
      const kolom = anak.filter((a) =>
        nilaiKondisi(a.conditionValue).includes(opt.value),
      );
      if (!kolom.every((a) => terisi(lookup(a.key)))) continue;
      const s = opt.score ?? 0;
      skor = isMulti(item) ? skor + s : Math.max(skor, s);
    }
    return skor;
  }
  if (item.thresholdValue != null) {
    const angka = typeof raw === 'number' ? raw : Number(raw);
    return angka != null && !Number.isNaN(angka) && angka < item.thresholdValue
      ? (item.score ?? 0)
      : 0;
  }
  return terisi(raw) ? (item.score ?? 0) : 0;
}

function maksItem(item: ScoringItemDef): number {
  const activeOptions = item.options.filter((o) => o.isActive);
  if (!activeOptions.length) return item.score ?? 0;
  const skor = activeOptions.map((o) => o.score ?? 0);
  return isMulti(item)
    ? skor.reduce((a, b) => a + b, 0)
    : Math.max(0, ...skor);
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
    const dapat = items.reduce(
      (s, i) =>
        s + nilaiItem(i, lookup, items.filter((a) => a.conditionItemId === i.key)),
      0,
    );
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

  // Centang multi: skor pilihan dijumlahkan; maks = jumlah semua pilihan.
  const sumber: ScoringTabDef = {
    bobot: 1,
    items: [
      { key: 'sumber', fieldType: 'CHECKBOX', score: null, isActive: true, options: [
        { value: 'pemda', score: 2, isActive: true },
        { value: 'masy', score: 1, isActive: true },
        { value: 'lain', score: 1, isActive: true },
      ] },
      // Kolom tambahan pilihan "lain": tanpa skor sendiri, jadi syarat.
      { key: 'ket', fieldType: 'TEXT', score: null, isActive: true, options: [],
        conditionItemId: 'sumber', conditionValue: '["lain"]' },
    ],
  };
  const isi = (v: Record<string, unknown>) => (k: string) => v[k];
  strictEqual(hitungSkorEvaluasi([sumber], isi({ sumber: ['pemda', 'masy'] })), 0.75);
  // "lain" dicentang tapi kolom tambahannya kosong -> belum dapat skor.
  strictEqual(hitungSkorEvaluasi([sumber], isi({ sumber: ['lain'] })), 0);
  strictEqual(hitungSkorEvaluasi([sumber], isi({ sumber: ['lain'], ket: '  ' })), 0);
  strictEqual(hitungSkorEvaluasi([sumber], isi({ sumber: ['lain'], ket: 'X' })), 0.25);
  // Dropdown (satu pilihan) tetap skor pilihan terpilih.
  const dd: ScoringTabDef = {
    bobot: 1,
    items: [{ key: 'pkpnId', fieldType: 'DROPDOWN', score: null, isActive: true, options: [
      { value: 'a', score: 3, isActive: true },
      { value: 'b', score: 1, isActive: true },
    ] }],
  };
  strictEqual(hitungSkorEvaluasi([dd], () => 'b'), 0.3333);
  strictEqual(hitungSkorEvaluasi([dd], () => 'zzz'), 0);

  // Kondisi: satu nilai, banyak nilai (JSON), boolean & checkbox multi.
  strictEqual(kondisiTerpenuhi('Lainnya', 'Lainnya'), true);
  strictEqual(kondisiTerpenuhi('["Pemda","Lainnya"]', 'Pemda'), true);
  strictEqual(kondisiTerpenuhi('["Pemda","Lainnya"]', ['X', 'Lainnya']), true);
  strictEqual(kondisiTerpenuhi('["Pemda"]', 'K/L'), false);
  strictEqual(kondisiTerpenuhi('true', true), true);
  strictEqual(kondisiTerpenuhi('true', undefined), false);

  // Tab nonaktif/tanpa item aktif tidak boleh bikin NaN.
  strictEqual(hitungSkorEvaluasi([{ bobot: 0.2, items: [] }], lookupKosong), 0);
  strictEqual(hitungSkorEvaluasi([], lookupKosong), 0);

  console.log('form-skor OK');
}
