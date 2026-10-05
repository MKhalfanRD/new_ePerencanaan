"use client";

import React from "react";
import {
  FieldControl,
  type FieldControlValue,
} from "@/components/master/field-control";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sourceRowsFor, useSourceData } from "@/lib/option-sources";
import type { FormItemNode, FormTabNode } from "./proyek-form-dialog";

/**
 * Field paket dari template tab "Pemaketan" — dipakai form Buat Proyek
 * (inline, banyak paket) & dialog Tambah/Edit Paket supaya keduanya ikut
 * pengaturan admin yang sama. Key `paket*` = kolom tabel Paket (renderer
 * khusus di masing-masing host); item lain = field custom, nilainya
 * dikirim sebagai `formValues` -> paket_form_value.
 */

export type PaketSection = FormTabNode["sections"][number];
export type FormValuesMap = Record<string, FieldControlValue>;

// Urutan & label default = isi seed (dipakai kalau template belum punya
// field paket sama sekali).
const PAKET_DEFAULT_ITEMS: [string, string, string][] = [
  ["paketName", "Nama Paket", "TEXT"],
  ["paketRo", "RO (Rincian Output)", "DROPDOWN"],
  ["paketKomponen", "Komponen", "DROPDOWN"],
  ["paketIndikatorRo", "Indikator RO (IRO)", "DROPDOWN"],
  ["paketJenis", "Jenis Paket", "DROPDOWN"],
  ["paketMasa", "Masa Pelaksanaan", "DROPDOWN"],
  ["paketDokLing", "Dokumen Lingkungan (status)", "TEXT"],
];
export const PAKET_BAKU_KEYS = PAKET_DEFAULT_ITEMS.map(([k]) => k);
// Kolom NOT NULL di tabel Paket — selalu tampil & wajib walau admin
// sembunyikan/hapus item-nya (jenis/masa cukup punya default).
export const PAKET_ALWAYS_REQUIRED_KEYS = [
  "paketName",
  "paketRo",
  "paketJenis",
  "paketMasa",
];
const PAKET_WIDE_KEYS = new Set(["paketName", "paketRo", "paketDokLing"]);

const defaultItem = ([key, label, fieldType]: [string, string, string]) => ({
  id: `default-${key}`,
  key,
  label,
  fieldType,
  options: [],
  required: key === "paketName" || key === "paketRo",
});

/** Section tab Pemaketan yang aktif. Nama & RO dijamin ada (wajib DB). */
export function paketSections(tabs: FormTabNode[] | undefined): PaketSection[] {
  const sections = (tabs?.find((t) => t.key === "pemaketan")?.sections ?? [])
    .filter((s) => s.isActive !== false)
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => i.isActive !== false),
    }));
  const keys = new Set(sections.flatMap((s) => s.items.map((i) => i.key)));
  if (!sections.some((s) => s.items.length)) {
    return [
      {
        id: "default-paket",
        key: "data-paket",
        label: "Data Paket",
        items: PAKET_DEFAULT_ITEMS.map(defaultItem),
      },
    ];
  }
  const missing = PAKET_DEFAULT_ITEMS.filter(
    ([k]) => (k === "paketName" || k === "paketRo") && !keys.has(k),
  ).map(defaultItem);
  if (missing.length) {
    sections.unshift({
      id: "default-paket-wajib",
      key: "data-paket-wajib",
      label: "",
      items: missing,
    });
  }
  return sections;
}

/** Lebar field baku paket: ikut pengaturan admin, default nama/RO/dokling penuh. */
export function paketItemWide(item: FormItemNode) {
  return item.width ? item.width === "FULL" : PAKET_WIDE_KEYS.has(item.key);
}

export function isRequiredPaketItem(item: FormItemNode) {
  return PAKET_ALWAYS_REQUIRED_KEYS.includes(item.key) || !!item.required;
}

/** Label item wajib pertama yang masih kosong, atau null. `bakuValue`
 * membaca kolom Paket utk key paket*. */
export function findMissingPaketItem(
  sections: PaketSection[],
  bakuValue: (key: string) => unknown,
  values: FormValuesMap,
): string | null {
  const kosong = (v: unknown) => v == null || v === "" || v === false;
  for (const s of sections)
    for (const item of s.items) {
      if (!isRequiredPaketItem(item) || item.fieldType === "UPLOAD") continue;
      const v = PAKET_BAKU_KEYS.includes(item.key)
        ? bakuValue(item.key)
        : values[item.key]?.value;
      if (kosong(v)) return item.label;
    }
  return null;
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
    if (fv.item.fieldType === "CHECKBOX" && fv.item.optionSource && fv.valueText) {
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

export function PaketTemplateFields({
  sections,
  renderers,
  values,
  onChange,
}: {
  sections: PaketSection[];
  renderers: Record<string, (item: FormItemNode) => React.ReactNode>;
  values: FormValuesMap;
  onChange: (key: string, patch: FieldControlValue) => void;
}) {
  const sourceData = useSourceData(
    sections.flatMap((s) =>
      s.items
        .filter((i) => !PAKET_BAKU_KEYS.includes(i.key))
        .map((i) => i.optionSource),
    ),
  );
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.id} className="space-y-3">
          {section.label && sections.length > 1 && (
            <p className="text-xs font-semibold text-muted-foreground">
              {section.label}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {section.items.map((item) =>
              renderers[item.key] ? (
                <div
                  key={item.id}
                  className={cn(
                    "space-y-2",
                    paketItemWide(item) && "sm:col-span-full",
                  )}
                >
                  {renderers[item.key](item)}
                </div>
              ) : item.fieldType === "UPLOAD" ? null : (
                <div
                  key={item.id}
                  className={cn(paketItemWide(item) && "sm:col-span-full")}
                >
                  <FieldControl
                    mode="fill"
                    item={item}
                    value={values[item.key]}
                    onChange={(patch) => onChange(item.key, patch)}
                    sourceRows={
                      item.optionSource
                        ? sourceRowsFor(
                            item.key,
                            item.optionSource,
                            sourceData[item.optionSource] ?? [],
                          )
                        : undefined
                    }
                  />
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Label field baku paket (asterisk ikut wajib/tidaknya). */
export function PaketLabel({ item }: { item: FormItemNode }) {
  return (
    <Label className="text-xs">
      {item.label}
      {isRequiredPaketItem(item) && (
        <span className="text-destructive"> *</span>
      )}
    </Label>
  );
}
