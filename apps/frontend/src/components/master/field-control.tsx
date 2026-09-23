"use client";

import { Paperclip, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * SATU sumber kebenaran untuk bentuk sebuah field Form Proyek — dipakai
 * DUA tempat:
 *  - Kanvas Master Data (`form-proyek-tab.tsx`), mode="preview": SAMA PERSIS
 *    markup-nya dengan mode="fill" (label, ukuran input, spacing) — cuma
 *    dikunci `disabled` & tidak terikat value sungguhan, supaya admin lihat
 *    bentuk asli field, bukan versi mini terpisah.
 *  - Form "Buat Proyek" (`proyek-form-dialog.tsx`), mode="fill": kontrol
 *    interaktif nyata, terikat ke formValuesMap.
 *
 * Kalau dua mode ini render markup BEDA per fieldType, kanvas admin akan
 * selalu terasa "beda" dari form asli — makanya tiap case di bawah cuma satu
 * definisi JSX, beda dikit lewat `disabled`/`value` sesuai mode.
 */

const NONE = "__FIELD_CONTROL_NONE__";

function FieldLabel({ item }: { item: FieldControlItem }) {
  return (
    <Label>
      {item.label}
      {item.required && <span className="text-destructive"> *</span>}
    </Label>
  );
}

export interface FieldControlOption {
  id: string;
  value: string;
  label: string;
  isActive?: boolean;
  score?: number | null;
}
export interface FieldControlItem {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  thresholdValue?: number | null;
  options: FieldControlOption[];
  // Cuma dipakai kanvas admin (form-proyek-tab.tsx) buat menyamakan
  // placeholder/asterisk field "baku" yang di form user dirender lewat
  // renderer khusus (bukan FieldControl), jadi placeholder/wajib-nya
  // hardcode di sana, bukan dari database — lihat BAKU_PREVIEW.
  placeholder?: string;
  required?: boolean;
}
export type FieldControlValue = {
  value?: string | boolean | number;
  note?: string;
};

export function FieldControl({
  item,
  mode,
  value,
  onChange,
  uploadedFileName,
  uploading,
  onUpload,
  onRemoveUpload,
}: {
  item: FieldControlItem;
  mode: "preview" | "fill";
  value?: FieldControlValue;
  onChange?: (patch: FieldControlValue) => void;
  // Khusus fieldType UPLOAD — parent (proyek-form-dialog.tsx) yang menyimpan
  // file itu sendiri (langsung atau ditahan dulu), bukan lewat value/onChange
  // seperti field lain, supaya tidak nyasar ke formValues/skor evaluasi
  // (lihat proyek.service.ts hitungEvaluasi — UPLOAD dicek dari
  // DokumenPendukung, bukan formValues).
  uploadedFileName?: string | null;
  uploading?: boolean;
  onUpload?: (files: File[]) => void;
  onRemoveUpload?: () => void;
}) {
  const preview = mode === "preview";

  // Item "otomatis" (mis. rasio Valuasi dihitung server dari alokasi paket)
  // — bukan kontrol form sama sekali, di kedua mode.
  if (item.thresholdValue != null) {
    return (
      <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        Dihitung otomatis dari alokasi paket — terpenuhi kalau nilai hasil
        hitung lebih kecil dari{" "}
        <strong className="text-foreground">{item.thresholdValue}</strong>.
      </div>
    );
  }

  switch (item.fieldType) {
    case "DROPDOWN": {
      const activeOptions = item.options.filter((o) => o.isActive !== false);
      return (
        <div className="space-y-2">
          <FieldLabel item={item} />
          <Select
            disabled={preview}
            value={preview ? NONE : ((value?.value as string) ?? NONE)}
            onValueChange={(v) =>
              onChange?.({ value: v === NONE ? undefined : v })
            }
          >
            <SelectTrigger className="w-full h-10">
              <SelectValue placeholder={item.placeholder ?? "Pilih..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Tidak ada —</SelectItem>
              {activeOptions.map((o) => (
                <SelectItem key={o.id} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    case "CHECKBOX":
      return (
        <label className="flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            disabled={preview}
            className="h-4 w-4 accent-primary"
            checked={preview ? false : !!value?.value}
            onChange={
              preview
                ? undefined
                : (e) => onChange?.({ value: e.target.checked })
            }
          />
          {item.label}
        </label>
      );
    case "FIELDBOX":
      return (
        <div className="space-y-2">
          <FieldLabel item={item} />
          <Textarea
            disabled={preview}
            placeholder={item.placeholder}
            value={preview ? "" : ((value?.value as string) ?? "")}
            onChange={(e) => onChange?.({ value: e.target.value })}
          />
        </div>
      );
    case "UPLOAD":
      return (
        <div className="space-y-2">
          <FieldLabel item={item} />
          {!preview && uploadedFileName ? (
            <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 truncate">
                <Paperclip size={13} className="shrink-0 text-muted-foreground" />
                {uploadedFileName}
              </span>
              {onRemoveUpload && (
                <button
                  type="button"
                  className="shrink-0 text-destructive text-[11px] hover:underline"
                  onClick={onRemoveUpload}
                >
                  Hapus
                </button>
              )}
            </div>
          ) : (
            <label
              className={
                preview
                  ? "flex items-center gap-2 rounded-md border-2 border-dashed px-3 py-3 text-[11px] text-muted-foreground"
                  : "flex cursor-pointer items-center gap-2 rounded-md border-2 border-dashed px-3 py-3 text-[11px] text-muted-foreground hover:bg-muted/40"
              }
            >
              {uploading ? (
                "Mengupload..."
              ) : (
                <>
                  <Upload size={14} className="shrink-0" />
                  Klik untuk upload file
                </>
              )}
              {!preview && (
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) onUpload?.(files);
                    e.target.value = "";
                  }}
                />
              )}
            </label>
          )}
        </div>
      );
    case "DATE":
      return (
        <div className="space-y-2">
          <FieldLabel item={item} />
          <Input
            disabled={preview}
            type="date"
            className="h-10"
            value={preview ? "" : ((value?.value as string) ?? "")}
            onChange={(e) => onChange?.({ value: e.target.value })}
          />
        </div>
      );
    case "NUMBER":
      return (
        <div className="space-y-2">
          <FieldLabel item={item} />
          <Input
            disabled={preview}
            type="number"
            placeholder="0"
            className="h-10"
            value={preview ? "" : ((value?.value as number) ?? "")}
            onChange={(e) =>
              onChange?.({
                value: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
      );
    default: // TEXT
      return (
        <div className="space-y-2">
          <FieldLabel item={item} />
          <Input
            disabled={preview}
            className="h-10"
            placeholder={item.placeholder}
            value={preview ? "" : ((value?.value as string) ?? "")}
            onChange={(e) => onChange?.({ value: e.target.value })}
          />
        </div>
      );
  }
}
