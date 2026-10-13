"use client";

import React from "react";
import type { FieldControlValue } from "@/components/master/field-control";
import { Label } from "@/components/ui/label";
import type { PaketRingkas } from "@/lib/form-score";
import type { Komponen, Paket, RO } from "@/types";
import type { FormItemNode, FormTabNode } from "./proyek-form-dialog";

/**
 * Tab "Pemaketan" format baru. Bagian bertanda `perPaket` = kartu di dialog
 * paket (diisi per paket), sisanya diisi sekali per proyek (saldo, kategori,
 * izin satker, daftar paket). Key di bawah = field inti (renderer khusus,
 * tidak bisa dihapus dari kanvas); field lain = custom -> paket_form_value.
 */

export type PaketSection = FormTabNode["sections"][number];
export type FormValuesMap = Record<string, FieldControlValue>;

export const PAKET_BAKU_KEYS = [
  "paketSatker",
  "paketName",
  "paketRo",
  "paketKomponen",
  "paketLokasiRo",
  "paketVolumeRo",
  "paketIndikatorRo",
  "paketTahun",
  "paketAlokasi",
  "paketLokasi",
];
export const PEMAKETAN_PROYEK_KEYS = [
  "saldoAnggaran",
  "saldoVolumeRo",
  "saldoVolumeIro",
  "satkerBolehUbahPaket",
  "daftarPaket",
];
/** Field inti Pemaketan — tidak bisa dihapus (backend juga menolak). */
export const PEMAKETAN_INTI_KEYS = new Set([
  ...PAKET_BAKU_KEYS,
  ...PEMAKETAN_PROYEK_KEYS,
  "kategoriProyek",
]);
// Kolom NOT NULL / inti paket — selalu wajib.
export const PAKET_ALWAYS_REQUIRED_KEYS = ["paketName", "paketRo", "paketTahun"];

export const SUMBER_DANA = ["rm", "rmp", "pln", "sbsn", "kpbu"] as const;
export type SumberDana = (typeof SUMBER_DANA)[number];

export interface PaketIsian {
  id?: string;
  kodePaket?: string;
  satkerId?: string;
  name: string;
  roId: string;
  komponenId?: string;
  lokasiRo: string[];
  volumeRo?: number;
  indikatorRo: { indikatorRoId: string; volume?: number; satuan?: string }[];
  tahunMulai?: number;
  tahunSelesai?: number;
  alokasi: ({ tahun: number } & Partial<Record<SumberDana, number>>)[];
  lokasiSamaProyek: boolean;
  provinceId?: string;
  provinceName?: string;
  cityId?: string;
  cityName?: string;
  districtId?: string;
  districtName?: string;
  villageId?: string;
  villageName?: string;
  tipeKoordinat?: "TITIK" | "GARIS" | "POLIGON";
  latitude?: number;
  longitude?: number;
  coordinates?: number[][];
  formValues: FormValuesMap;
}

export const paketKosong = (satkerId?: string | null): PaketIsian => ({
  satkerId: satkerId ?? undefined,
  name: "",
  roId: "",
  lokasiRo: [],
  indikatorRo: [],
  alokasi: [],
  lokasiSamaProyek: true,
  formValues: {},
});

const angka = (v: unknown) => (v == null || v === "" ? undefined : Number(v));

/** Paket dari server -> isian form. */
export function paketDariServer(p: Paket): PaketIsian {
  return {
    id: p.id,
    kodePaket: p.kodePaket,
    satkerId: p.satkerId ?? undefined,
    name: p.name,
    roId: p.roId,
    komponenId: p.komponenId ?? undefined,
    lokasiRo: p.lokasiRo ?? [],
    volumeRo: angka(p.volumeRo),
    indikatorRo: (p.indikatorRo ?? []).map((i) => ({
      indikatorRoId: i.indikatorRoId,
      volume: angka(i.volume),
      satuan: i.satuan ?? undefined,
    })),
    tahunMulai: p.tahunMulai ?? undefined,
    tahunSelesai: p.tahunSelesai ?? undefined,
    alokasi: (p.alokasi ?? [])
      .filter((a) => a.status === "RENCANA")
      .map((a) => ({
        tahun: a.tahun,
        ...Object.fromEntries(SUMBER_DANA.map((k) => [k, Number(a[k] ?? 0)])),
      })),
    lokasiSamaProyek: p.lokasiSamaProyek ?? true,
    provinceId: p.provinceId ?? undefined,
    provinceName: p.provinceName ?? undefined,
    cityId: p.cityId ?? undefined,
    cityName: p.cityName ?? undefined,
    districtId: p.districtId ?? undefined,
    districtName: p.districtName ?? undefined,
    villageId: p.villageId ?? undefined,
    villageName: p.villageName ?? undefined,
    tipeKoordinat: p.tipeKoordinat ?? undefined,
    latitude: p.latitude ?? undefined,
    longitude: p.longitude ?? undefined,
    coordinates: p.coordinates ?? undefined,
    formValues: fromFormValueRows(p.formValues),
  };
}

export const totalAlokasi = (a: Partial<Record<SumberDana, number>>) =>
  SUMBER_DANA.reduce((s, k) => s + (a[k] ?? 0), 0);

/** Alokasi yang tahunnya di dalam rentang paket. */
export const alokasiDalamRentang = (p: PaketIsian) =>
  p.alokasi.filter(
    (a) =>
      (!p.tahunMulai || a.tahun >= p.tahunMulai) &&
      (!p.tahunSelesai || a.tahun <= p.tahunSelesai),
  );

export const totalPaket = (p: PaketIsian) =>
  alokasiDalamRentang(p).reduce((s, a) => s + totalAlokasi(a), 0);

/** Isian -> body POST/PATCH /paket (dan `paket[]` Buat Proyek). */
export function paketKePayload(p: PaketIsian) {
  return {
    name: p.name,
    roId: p.roId,
    komponenId: p.komponenId || undefined,
    satkerId: p.satkerId || undefined,
    lokasiRo: p.lokasiRo,
    volumeRo: p.volumeRo,
    indikatorRo: p.indikatorRo.filter((i) => i.indikatorRoId),
    tahunMulai: p.tahunMulai,
    tahunSelesai: p.tahunSelesai,
    alokasi: alokasiDalamRentang(p),
    lokasiSamaProyek: p.lokasiSamaProyek,
    provinceId: p.provinceId,
    provinceName: p.provinceName,
    cityId: p.cityId,
    cityName: p.cityName,
    districtId: p.districtId,
    districtName: p.districtName,
    villageId: p.villageId,
    villageName: p.villageName,
    tipeKoordinat: p.lokasiSamaProyek ? undefined : (p.tipeKoordinat ?? "TITIK"),
    latitude: p.latitude,
    longitude: p.longitude,
    coordinates: p.coordinates,
    formValues: toFormValueList(p.formValues),
  };
}

/** Ringkasan rasio/saldo 1 paket (sama aturan backend paketRingkasDb). */
export function ringkasIsianPaket(
  p: PaketIsian,
  roList: RO[],
  komponenList: Komponen[],
): PaketRingkas {
  const komponen = komponenList.find((k) => k.id === p.komponenId);
  return {
    total: totalPaket(p),
    utama: (komponen?.jenis ?? "UTAMA") === "UTAMA",
    volumeRo: p.volumeRo ?? 0,
    satuanRo: roList.find((r) => r.id === p.roId)?.satuan?.name,
    iro: p.indikatorRo.map((i) => ({ volume: i.volume ?? 0, satuan: i.satuan })),
  };
}

/** Ringkasan paket dari server (include komponen & ro.satuan). */
export function ringkasPaketServer(p: Paket): PaketRingkas {
  return {
    total: (p.alokasi ?? [])
      .filter((a) => a.status === "RENCANA")
      .reduce((s, a) => s + Number(a.total ?? 0), 0),
    utama: (p.komponen?.jenis ?? "UTAMA") === "UTAMA",
    volumeRo: Number(p.volumeRo ?? 0),
    satuanRo: p.ro?.satuan?.name,
    iro: (p.indikatorRo ?? []).map((i) => ({ volume: Number(i.volume ?? 0), satuan: i.satuan })),
  };
}

/** Bagian Pemaketan yang diisi per paket (aktif). */
export function paketSections(tabs: FormTabNode[] | undefined): PaketSection[] {
  return (tabs?.find((t) => t.key === "pemaketan")?.sections ?? [])
    .filter((s) => s.perPaket && s.isActive !== false)
    .map((s) => ({ ...s, items: s.items.filter((i) => i.isActive !== false) }))
    .filter((s) => s.items.length);
}

export function isRequiredPaketItem(item: FormItemNode) {
  return PAKET_ALWAYS_REQUIRED_KEYS.includes(item.key) || !!item.required;
}

/** formValuesMap -> body `formValues` (sama format dgn proyek). */
export function toFormValueList(map: FormValuesMap) {
  return Object.entries(map)
    .filter(([, v]) => v.value !== undefined && v.value !== "")
    .map(([key, v]) => ({ key, value: v.value, note: v.note }));
}

/** Baris *_form_value dari backend -> formValuesMap. */
export function fromFormValueRows(
  rows:
    | {
        item: { key: string; fieldType?: string; optionSource?: string | null };
        option?: { value: string } | null;
        valueText?: string | null;
        valueNumber?: number | null;
      }[]
    | undefined,
): FormValuesMap {
  const map: FormValuesMap = {};
  for (const fv of rows ?? []) {
    // Checkbox multi-pilih dari master disimpan sebagai JSON array.
    if (fv.item.fieldType === "CHECKBOX" && fv.valueText?.startsWith("[")) {
      try {
        map[fv.item.key] = { value: JSON.parse(fv.valueText) };
        continue;
      } catch {
        // bukan JSON — perlakukan seperti nilai biasa di bawah
      }
    }
    // Checkbox polos tercentang tidak menyimpan value/valueText/valueNumber
    // apa pun — cuma keberadaan barisnya = "dicentang" (lihat
    // proyek.service.ts hitungEvaluasi). Kalau ketiganya kosong & item ini
    // tidak punya opsi, itu tandanya checkbox true, bukan field kosong.
    const value =
      fv.option?.value ??
      fv.valueNumber ??
      fv.valueText ??
      (fv.option ? undefined : true);
    map[fv.item.key] = {
      value,
      note: fv.option ? (fv.valueText ?? undefined) : undefined,
    };
  }
  return map;
}

/** Label field baku paket (asterisk ikut wajib/tidaknya). */
export function PaketLabel({ item, htmlFor }: { item: FormItemNode; htmlFor?: string }) {
  return (
    <Label className="text-xs" htmlFor={htmlFor}>
      {item.label}
      {isRequiredPaketItem(item) && <span className="text-destructive"> *</span>}
    </Label>
  );
}

// Contoh tampilan field inti di kanvas admin (kontrol aslinya butuh data
// proyek/master, jadi cukup bentuknya).
const CONTOH: Record<string, string[]> = {
  paketSatker: ["Pilih satker"],
  paketName: ["Nama paket"],
  paketRo: ["KRO", "RO"],
  paketKomponen: ["Komponen · utama/pendukung"],
  paketLokasiRo: ["Pilih provinsi (bisa lebih dari satu)"],
  paketVolumeRo: ["Volume", "Satuan RO"],
  paketIndikatorRo: ["Indikator RO", "Volume", "Satuan"],
  paketTahun: ["Tahun mulai", "Tahun selesai"],
  paketAlokasi: ["Tahun", "RM / RMP / PLN / SBSN / KPBU", "Total"],
  paketLokasi: ["Sama dengan lokasi proyek? Ya / Tidak (peta)"],
  saldoAnggaran: ["Rp 0", "Dipakai … · sisa …"],
  saldoVolumeRo: ["0", "Dipakai … · sisa …"],
  saldoVolumeIro: ["0", "Dipakai … · sisa …"],
  satkerBolehUbahPaket: ["Saklar ya / tidak"],
  daftarPaket: ["Tabel paket: Satker · Nama paket · Tahun · Alokasi", "+ Tambah paket"],
};
const LEBAR = new Set(["paketAlokasi", "paketIndikatorRo", "paketLokasi", "daftarPaket", "paketRo"]);

export function PemaketanBakuPreview({ item }: { item: FormItemNode }) {
  const isi = CONTOH[item.key] ?? [item.label];
  return (
    <div className={LEBAR.has(item.key) ? "col-span-full space-y-1.5" : "space-y-1.5"}>
      <PaketLabel item={item} />
      <div className="flex gap-2">
        {isi.map((t) => (
          <div
            key={t}
            className="flex h-9 min-w-0 flex-1 items-center truncate rounded-md border border-dashed bg-muted/40 px-3 text-xs text-muted-foreground"
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}
