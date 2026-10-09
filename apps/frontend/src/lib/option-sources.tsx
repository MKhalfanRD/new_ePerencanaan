"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

/**
 * Sumber pilihan Dropdown/Checkbox di Form Proyek (FormItem.optionSource).
 * Tiap sumber = satu tabel master & dari mana barisnya diambil. Editor
 * master yang dibuka dari kanvas ada di option-source-editors.tsx (dipisah
 * supaya tidak ikut ter-bundle ke halaman proyek).
 */
export interface SourceRow {
  value: string;
  label: string;
}
interface OptionSourceDef {
  label: string;
  endpoint?: string;
  rows?: (data: any[]) => SourceRow[];
  // Sumber bertingkat: pilihan disaring dari nilai induknya. parent =
  // sumber field induk (dipilih admin di optionParentKey), atau "kegiatan"
  // = kegiatan proyek (otomatis, tanpa field induk).
  parent?: string;
  rowsBy?: (data: any[], parentValue: string) => SourceRow[];
  // Satu-satunya pilihan langsung terisi (RO/Komponen cuma punya 1 satuan).
  autoPick?: boolean;
  // Editor di option-source-editors.tsx kalau beda dari key sumbernya.
  editor?: string;
}

const byIdName = (data: any[]) =>
  data.map((r) => ({ value: String(r.id), label: r.name }));
const satuanDari = (s?: { id: string; name: string } | null): SourceRow[] =>
  s ? [{ value: s.id, label: s.name }] : [];

// Field paket bawaan yang pilihannya juga dari Nomenklatur — boleh jadi
// induk field ber-sumber bertingkat (mis. Satuan RO mengikuti paketRo).
export const SOURCE_OF_BAKU: Record<string, string> = {
  paketRo: "ro",
  paketKomponen: "komponen",
  paketIndikatorRo: "indikatorRo",
};
export const sumberField = (item: { key: string; optionSource?: string | null }) =>
  item.optionSource ?? SOURCE_OF_BAKU[item.key];

export const OPTION_SOURCES: Record<string, OptionSourceDef> = {
  balai: { label: "Balai", endpoint: "/master/balai", rows: byIdName },
  periode: {
    label: "Periode",
    endpoint: "/master/periodes",
    rows: (d) => d.map((p) => ({ value: String(p.id), label: p.label })),
  },
  wilayahSungai: {
    label: "Wilayah Sungai",
    endpoint: "/master/wilayah-sungai",
    rows: byIdName,
  },
  sumberUsulan: {
    label: "Sumber Usulan Proyek",
    endpoint: "/master/sumber-usulan-proyek",
    rows: byIdName,
  },
  pkpn: {
    label: "PKPN",
    endpoint: "/master/pkpn",
    rows: byIdName,
  },
  tematikRenja: {
    label: "Tematik RENJA",
    endpoint: "/master/tematik-renja",
    rows: byIdName,
  },
  taggingDinamis: {
    label: "Tagging Dinamis",
    endpoint: "/master/tagging-dinamis",
    rows: byIdName,
  },
  kegiatanPrioritas: {
    label: "PN / PP / KP",
    endpoint: "/master/kegiatan-prioritas",
    rows: (d) =>
      d.map((k) => ({ value: k.id, label: `${k.code} — ${k.name}` })),
  },
  isp: {
    label: "Indikator Sasaran Program (ISP)",
    endpoint: "/master/sasaran-program",
    rows: (d) => d.flatMap((sp) => byIdName(sp.indikator ?? [])),
  },
  isk: {
    label: "Indikator Sasaran Kegiatan (ISK)",
    endpoint: "/master/sasaran-kegiatan",
    rows: (d) => d.flatMap((sk) => byIdName(sk.indikator ?? [])),
  },
  satuan: { label: "Satuan", endpoint: "/master/satuan", rows: byIdName },
  ro: {
    label: "RO (ikut kegiatan proyek)",
    endpoint: "/master/ro",
    editor: "nomenklatur",
    parent: "kegiatan",
    rowsBy: (d, kegiatanId) =>
      d
        .filter((r) => r.kro?.kegiatan?.id === kegiatanId)
        .map((r) => ({
          value: r.id,
          label: `${r.kro.kegiatan.code} · ${r.kro.code} · ${r.code}  ${r.name}`,
        })),
  },
  komponen: {
    label: "Komponen (ikut RO)",
    endpoint: "/master/komponen",
    editor: "nomenklatur",
    parent: "ro",
    rowsBy: (d, roId) =>
      d
        .filter((k) => k.roId === roId)
        .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
        .map((k) => ({ value: k.id, label: `${k.code} ${k.name}` })),
  },
  indikatorRo: {
    label: "Indikator RO (ikut RO)",
    endpoint: "/master/indikator-ro",
    editor: "nomenklatur",
    parent: "ro",
    rowsBy: (d, roId) =>
      d.filter((i) => i.roId === roId).map((i) => ({ value: i.id, label: i.nama })),
  },
  satuanRo: {
    label: "Satuan RO (ikut RO)",
    endpoint: "/master/ro",
    editor: "nomenklatur",
    parent: "ro",
    autoPick: true,
    rowsBy: (d, roId) => satuanDari(d.find((r) => r.id === roId)?.satuan),
  },
  satuanKomponen: {
    label: "Satuan Komponen (ikut Komponen)",
    endpoint: "/master/komponen",
    editor: "nomenklatur",
    parent: "komponen",
    autoPick: true,
    rowsBy: (d, id) => satuanDari(d.find((k) => k.id === id)?.satuan),
  },
  satuanIro: {
    label: "Satuan Indikator RO (ikut Indikator RO)",
    endpoint: "/master/indikator-ro",
    editor: "nomenklatur",
    parent: "indikatorRo",
    autoPick: true,
    rowsBy: (d, id) =>
      (d.find((i) => i.id === id)?.satuanList ?? []).flatMap((s: any) =>
        satuanDari(s.satuan),
      ),
  },
  // Data referensi wilayah administratif (BPS) — tidak dikelola di aplikasi.
  wilayah: { label: "Wilayah Administratif (BPS)" },
};

// Field bawaan yang kolomnya menyimpan NAMA, bukan id (lihat Proyek di
// schema.prisma) — value opsi skornya ikut nama.
const VALUE_BY_NAME = new Set(["sumberUsulanProyek", "taggingDinamis"]);

/** Baris sumber utk item tertentu (value = nilai yang disimpan field). */
export function sourceRowsFor(itemKey: string, source: string, data: any[]) {
  const def = OPTION_SOURCES[source];
  if (!def?.rows) return [];
  return VALUE_BY_NAME.has(itemKey)
    ? data.map((r) => ({ value: r.name, label: r.name }))
    : def.rows(data);
}

/**
 * Pilihan field ber-sumber utk form user. undefined = data sumber belum
 * dimuat (jangan dianggap kosong). Sumber bertingkat disaring dari nilai
 * field induknya (`lookup(optionParentKey)`) atau kegiatan proyek.
 */
export function rowsForItem(
  item: { key: string; optionSource?: string | null; optionParentKey?: string | null },
  data: Record<string, any[]>,
  lookup: (key: string) => unknown,
  kegiatanId?: string | null,
): SourceRow[] | undefined {
  if (!item.optionSource) return undefined;
  const d = data[item.optionSource];
  if (!d) return undefined;
  const def = OPTION_SOURCES[item.optionSource];
  if (!def?.rowsBy) return sourceRowsFor(item.key, item.optionSource, d);
  const induk =
    def.parent === "kegiatan"
      ? kegiatanId
      : item.optionParentKey
        ? lookup(item.optionParentKey)
        : undefined;
  return induk ? def.rowsBy(d, String(induk)) : [];
}

/** Data mentah tiap sumber yang dipakai (sekali fetch per sumber).
 * `refreshToken` dinaikkan setelah isi master diubah dari kanvas. */
export function useSourceData(sources: (string | null | undefined)[], refreshToken = 0) {
  const [data, setData] = useState<Record<string, any[]>>({});
  const keys = [...new Set(sources)]
    .filter((s): s is string => !!s && !!OPTION_SOURCES[s]?.endpoint)
    .sort()
    .join(",");
  useEffect(() => {
    if (!keys) return;
    const list = keys.split(",");
    Promise.all(list.map((s) => api.get(OPTION_SOURCES[s].endpoint!)))
      .then((res) =>
        setData(Object.fromEntries(list.map((s, i) => [s, res[i].data]))),
      )
      .catch(() => {});
  }, [keys, refreshToken]);
  return data;
}

/**
 * Label bagian dalam field gabungan (FormItem.subLabels) — default di sini,
 * admin bisa ganti per template dari kanvas.
 */
const TAHUN = { tahun: "Tahun" };
export const SUB_LABEL_DEFAULTS: Record<string, Record<string, string>> = {
  kegiatanPrioritasId: {
    pn: "Prioritas Nasional (PN)",
    pp: "Program Prioritas (PP)",
    kp: "Kegiatan Prioritas (KP)",
  },
  indikatorSasaranProgramId: { sp: "Sasaran Program (SP)" },
  indikatorSasaranKegiatanId: { sk: "Sasaran Kegiatan (SK)" },
  provinceId: {
    province: "Provinsi",
    city: "Kota/Kabupaten",
    district: "Kecamatan",
    village: "Desa/Kelurahan",
  },
  statusStudiLayak: TAHUN,
  statusDed: TAHUN,
  statusDokumenLingkungan: TAHUN,
  statusLarap: TAHUN,
};

export function subLabel(
  item: { key: string; subLabels?: Record<string, string> | null },
  part: string,
) {
  return item.subLabels?.[part] || SUB_LABEL_DEFAULTS[item.key]?.[part] || part;
}
