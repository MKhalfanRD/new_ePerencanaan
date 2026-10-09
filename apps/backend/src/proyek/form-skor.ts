/**
 * Skor evaluasi proyek dari struktur Form Proyek (Master Data), menggantikan
 * evaluasi-skor.ts + evaluasi-deteksi.ts (MetodeEvaluasi/EvaluasiItem).
 *
 * Skor field/pilihan = BOBOT % LANGSUNG (desimal, mis. 2.73). Nilai tab =
 * jumlah bobot yang didapat, dibatasi bobot tab x 100; skor evaluasi =
 * jumlah nilai semua tab ber-bobot / 100 (pecahan 0..1, kolom skorEvaluasi).
 * Tab tanpa bobot tidak dihitung. Admin dibatasi di kanvas supaya bobot
 * terpakai (maksTab) tidak melebihi bobot tab.
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
  // Simbol syarat rasio terhadap thresholdValue (default "<").
  operator?: string | null;
}
export interface ScoringTabDef {
  key?: string;
  label?: string;
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

// ===== Rasio Valuasi (field tipe RASIO) — SAMA dengan frontend
// lib/form-score.ts. A/B/C = total semua paket (alokasi RENCANA). =====
export interface RasioConfig {
  pembilang?: string;
  penyebut?: string;
  operator?: string;
  satuan?: string;
}
export interface RingkasPaket {
  A: number; // total anggaran (Rp)
  B: number; // total volume RO
  C: number; // total volume Indikator RO
  satuanB: string[]; // satuan volume RO yang dipakai (unik)
  satuanC: string[];
}
export const SKALA_RP: Record<string, number> = {
  rp: 1,
  ribu: 1e3,
  juta: 1e6,
  miliar: 1e9,
};
export function bandingkan(nilai: number, operator: string, standar: number): boolean {
  switch (operator) {
    case '<=': return nilai <= standar;
    case '>': return nilai > standar;
    case '>=': return nilai >= standar;
    case '=': return Math.abs(nilai - standar) < 1e-9;
    default: return nilai < standar;
  }
}
/** Jumlah anggaran/volume semua alokasi RENCANA semua paket. */
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
  const rencana = alokasi.filter((a) => !a.status || a.status === 'RENCANA');
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
/**
 * Nilai rasio pembilang:penyebut. A dibagi skala satuan standar (mis. juta).
 * null = tidak bisa dihitung (penyebut 0, atau volume bersatuan campur).
 */
export function hitungRasio(cfg: RasioConfig | null | undefined, r: RingkasPaket): number | null {
  if (!cfg?.pembilang || !cfg.penyebut) return null;
  const skala = SKALA_RP[cfg.satuan ?? 'juta'] ?? 1e6;
  const nilai = (h: string): number | null =>
    h === 'A' ? r.A / skala
    : h === 'B' ? (r.satuanB.length > 1 ? null : r.B)
    : h === 'C' ? (r.satuanC.length > 1 ? null : r.C)
    : null;
  const atas = nilai(cfg.pembilang);
  const bawah = nilai(cfg.penyebut);
  // Angka yang belum terisi (0) = belum bisa dihitung, bukan "lolos".
  if (atas == null || bawah == null || atas === 0 || bawah === 0) return null;
  return atas / bawah;
}

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
    if (raw == null || raw === '') return 0;
    const angka = typeof raw === 'number' ? raw : Number(raw);
    return !Number.isNaN(angka) &&
      bandingkan(angka, item.operator ?? '<', item.thresholdValue)
      ? (item.score ?? 0)
      : 0;
  }
  // Centang tunggal/field biasa: kolom tambahannya (muncul saat dicentang,
  // nilai "true") harus terisi dulu — sama dengan aturan pilihan di atas.
  const kolom = anak.filter((a) => nilaiKondisi(a.conditionValue).includes('true'));
  return terisi(raw) && kolom.every((a) => terisi(lookup(a.key)))
    ? (item.score ?? 0)
    : 0;
}

function maksItem(item: ScoringItemDef): number {
  const activeOptions = item.options.filter((o) => o.isActive);
  if (!activeOptions.length) return item.score ?? 0;
  const skor = activeOptions.map((o) => o.score ?? 0);
  return isMulti(item)
    ? skor.reduce((a, b) => a + b, 0)
    : Math.max(0, ...skor);
}

/**
 * Bobot terpakai 1 tab = nilai tertinggi yang mungkin didapat. Field tanpa
 * syarat dijumlah; field bersyarat dikelompokkan per field pemicu dan
 * diambil kelompok nilai pemicu dengan jumlah terbesar (mis. set "Khusus
 * pembangunan jaringan" vs "Khusus rehabilitasi" tidak dijumlah dua kali).
 * Sama persis dengan frontend lib/form-score.ts & migrasi skor_jadi_bobot.
 */
export function maksTab(items: ScoringItemDef[]): number {
  let total = 0;
  const perPemicu = new Map<string, Map<string, number>>();
  for (const i of items.filter((x) => x.isActive)) {
    const m = maksItem(i);
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

export interface RincianTab {
  key?: string;
  label?: string;
  // Bobot % didapat & bobot tab (%) — mis. 13.5 / 30.
  dapat: number;
  bobot: number;
}

const bulat = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

/** Nilai per tab ber-bobot (dipakai rekap tab Evaluasi). */
export function rincianSkor(
  tabs: ScoringTabDef[],
  lookup: ItemValueLookup,
): RincianTab[] {
  return tabs
    .filter((t) => t.bobot != null)
    .map((tab) => {
      const items = tab.items.filter((i) => i.isActive);
      const bobot = tab.bobot! * 100;
      const dapat = items.reduce(
        (s, i) =>
          s + nilaiItem(i, lookup, items.filter((a) => a.conditionItemId === i.key)),
        0,
      );
      return {
        key: tab.key,
        label: tab.label,
        dapat: bulat(Math.min(dapat, bobot), 2),
        bobot: bulat(bobot, 2),
      };
    });
}

export function hitungSkorEvaluasi(
  tabs: ScoringTabDef[],
  lookup: ItemValueLookup,
): number {
  const total = rincianSkor(tabs, lookup).reduce((s, r) => s + r.dapat, 0);
  // Pecahan 0..1, 4 desimal — sama presisi kolom skorEvaluasi di schema.
  return bulat(total / 100);
}

// Self-check — npx ts-node src/proyek/form-skor.ts
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { strictEqual }: { strictEqual: (a: unknown, b: unknown) => void } =
    require('assert');

  // Skor = bobot % langsung; nilai tab = jumlah yang didapat.
  const dasar: ScoringTabDef = {
    bobot: 0.3,
    items: [
      { key: 'sumberUsulanProyek', score: null, isActive: true, options: [
        { value: 'Pemerintah Daerah', score: 15, isActive: true },
        { value: 'Kementerian/Lembaga', score: 30, isActive: true },
      ] },
    ],
  };
  const kesiapan: ScoringTabDef = {
    bobot: 0.25,
    items: [
      { key: 'statusDed', score: null, isActive: true, options: [
        { value: 'SUDAH_ADA', score: 16.67, isActive: true },
        { value: 'RENCANA', score: 0, isActive: true },
      ] },
      { key: 'kebutuhanTanah', score: 8.33, isActive: true, options: [] },
    ],
  };
  const lookupA: ItemValueLookup = (key) =>
    ({ sumberUsulanProyek: 'Kementerian/Lembaga', statusDed: 'SUDAH_ADA', kebutuhanTanah: false }[key]);
  // 30 + 16.67 = 46.67% -> 0.4667
  strictEqual(hitungSkorEvaluasi([dasar, kesiapan], lookupA), 0.4667);
  const lookupKosong: ItemValueLookup = () => undefined;
  strictEqual(hitungSkorEvaluasi([dasar, kesiapan], lookupKosong), 0);

  // Centang multi: bobot pilihan dijumlahkan.
  const sumber: ScoringTabDef = {
    bobot: 1,
    items: [
      { key: 'sumber', fieldType: 'CHECKBOX', score: null, isActive: true, options: [
        { value: 'pemda', score: 50, isActive: true },
        { value: 'masy', score: 25, isActive: true },
        { value: 'lain', score: 25, isActive: true },
      ] },
      // Kolom tambahan pilihan "lain": tanpa skor sendiri, jadi syarat.
      { key: 'ket', fieldType: 'TEXT', score: null, isActive: true, options: [],
        conditionItemId: 'sumber', conditionValue: '["lain"]' },
    ],
  };
  const isi = (v: Record<string, unknown>) => (k: string) => v[k];
  strictEqual(hitungSkorEvaluasi([sumber], isi({ sumber: ['pemda', 'masy'] })), 0.75);
  strictEqual(hitungSkorEvaluasi([sumber], isi({ sumber: ['lain'] })), 0);
  strictEqual(hitungSkorEvaluasi([sumber], isi({ sumber: ['lain'], ket: '  ' })), 0);
  strictEqual(hitungSkorEvaluasi([sumber], isi({ sumber: ['lain'], ket: 'X' })), 0.25);
  // Dropdown: bobot pilihan terpilih.
  const dd: ScoringTabDef = {
    bobot: 1,
    items: [{ key: 'pkpnId', fieldType: 'DROPDOWN', score: null, isActive: true, options: [
      { value: 'a', score: 30, isActive: true },
      { value: 'b', score: 10, isActive: true },
    ] }],
  };
  strictEqual(hitungSkorEvaluasi([dd], () => 'b'), 0.1);
  strictEqual(hitungSkorEvaluasi([dd], () => 'zzz'), 0);
  // Nilai tab tidak bisa lewat bobot tab.
  strictEqual(hitungSkorEvaluasi([{ bobot: 0.1, items: dd.items }], () => 'a'), 0.1);

  // Centang tunggal + kolom tambahan: bobot masuk setelah keterangan diisi.
  const kinerja: ScoringTabDef = {
    bobot: 0.15,
    items: [
      { key: 'k1', fieldType: 'CHECKBOX', score: 3, isActive: true, options: [] },
      { key: 'ket1', fieldType: 'FIELDBOX', score: null, isActive: true, options: [],
        conditionItemId: 'k1', conditionValue: '["true"]' },
    ],
  };
  strictEqual(hitungSkorEvaluasi([kinerja], isi({ k1: true })), 0);
  strictEqual(hitungSkorEvaluasi([kinerja], isi({ k1: true, ket1: 'ok' })), 0.03);
  strictEqual(hitungSkorEvaluasi([kinerja], isi({ ket1: 'ok' })), 0);

  // Rasio: semua paket (RENCANA saja), skala juta, simbol syarat.
  const rk = ringkasPaket([
    { status: 'RENCANA', total: 2_000_000_000, outputTarget: 100, outputUnit: 'meter' },
    { status: 'REALISASI', total: 9_999_000_000, outputTarget: 999 },
    { status: 'RENCANA', total: 1_600_000_000, outputTarget: 100, outputUnit: 'meter' },
  ]);
  strictEqual(rk.A, 3_600_000_000);
  strictEqual(hitungRasio({ pembilang: 'A', penyebut: 'B', satuan: 'juta' }, rk), 18);
  strictEqual(
    hitungRasio({ pembilang: 'A', penyebut: 'B' }, { ...rk, satuanB: ['meter', 'unit'] }),
    null,
  );
  const val: ScoringTabDef = {
    bobot: 0.15,
    items: [{ key: 'r', score: 5, isActive: true, options: [], thresholdValue: 20, operator: '<' }],
  };
  strictEqual(hitungSkorEvaluasi([val], () => 18), 0.05);
  strictEqual(hitungRasio({ pembilang: 'C', penyebut: 'B' }, rk), null); // C masih 0
  strictEqual(hitungSkorEvaluasi([val], () => null), 0);
  strictEqual(hitungSkorEvaluasi([{ ...val, items: [{ ...val.items[0], operator: '>=' }] }], () => 18), 0);

  // maksTab: set bersyarat alternatif tidak dijumlah dua kali.
  const valuasi: ScoringItemDef[] = [
    { key: 'kategori', score: null, isActive: true, options: [] },
    { key: 'r1', score: 5, isActive: true, options: [], conditionItemId: 'kategori', conditionValue: 'bangun' },
    { key: 'r2', score: 5, isActive: true, options: [], conditionItemId: 'kategori', conditionValue: 'bangun' },
    { key: 'r3', score: 7, isActive: true, options: [], conditionItemId: 'kategori', conditionValue: 'rehab' },
    { key: 'x', score: 3, isActive: true, options: [] },
    { key: 'mati', score: 99, isActive: false, options: [] },
  ];
  strictEqual(maksTab(valuasi), 13);
  strictEqual(maksTab(sumber.items), 100);

  // Kondisi: satu nilai, banyak nilai (JSON), boolean & checkbox multi.
  strictEqual(kondisiTerpenuhi('Lainnya', 'Lainnya'), true);
  strictEqual(kondisiTerpenuhi('["Pemda","Lainnya"]', 'Pemda'), true);
  strictEqual(kondisiTerpenuhi('["Pemda","Lainnya"]', ['X', 'Lainnya']), true);
  strictEqual(kondisiTerpenuhi('["Pemda"]', 'K/L'), false);
  strictEqual(kondisiTerpenuhi('true', true), true);
  strictEqual(kondisiTerpenuhi('true', undefined), false);

  strictEqual(hitungSkorEvaluasi([{ bobot: 0.2, items: [] }], lookupKosong), 0);
  strictEqual(hitungSkorEvaluasi([], lookupKosong), 0);

  console.log('form-skor OK');
}
