"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileText,
  Layers,
  ListChecks,
  MapPin,
  Tag,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { kondisiTerpenuhi } from "@/lib/form-condition";
import { fmtSkor, fmtRupiahRingkas, ringkasPaket, teksRasio } from "@/lib/form-score";
import { rowsForItem, useSourceData } from "@/lib/option-sources";
import type { Proyek } from "@/types";
import type { FormItemNode, FormTabNode } from "./proyek-form-dialog";
import { fromFormValueRows, ringkasPaketServer } from "./paket-template";

/**
 * Isi usulan di detail proyek = form proyek dalam mode baca. Struktur (tab,
 * bagian, kolom, urutan, label, syarat "Tampil jika") dibaca dari template
 * aktif kegiatan proyek, jadi kolom yang ditambah/diubah admin di Master Data
 * › Form Proyek otomatis ikut tampil. Kolom kosong ditampilkan "–".
 */

type Rincian = { key?: string; label?: string; dapat: number; bobot: number };
type Nilai = React.ReactNode | null | undefined;
const LEWATI = Symbol("lewati"); // kolom yang memang tidak dirender di form

const IKON: Record<string, typeof MapPin> = {
  identitas: MapPin,
  dasar: FileText,
  lokasi: MapPin,
  kesiapan: ListChecks,
  pemaketan: Layers,
  tematik: Tag,
  valuasi: BarChart3,
  kinerja: ClipboardCheck,
  dokumen: FileText,
  evaluasi: BarChart3,
};

const STATUS_KRITERIA: Record<string, string> = {
  RENCANA: "Rencana",
  SUDAH_ADA: "Sudah Ada",
  TIDAK_PERLU: "Tidak Perlu",
};
const TAHUN_KRITERIA: Record<string, keyof Proyek> = {
  statusStudiLayak: "tahunStudiLayak",
  statusDed: "tahunDed",
  statusLarap: "tahunLarap",
  statusDokumenLingkungan: "tahunDokumenLingkungan",
};

const ada = (v: unknown) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0);
const yaTidak = (v: unknown) => (v ? "Ya" : "Tidak");
const angka = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 4 });
const labelOpsi = (item: FormItemNode, value: string, fallback: string) =>
  item.options.find((o) => o.value === value)?.label || fallback;

function Berkas({ d }: { d: { fileName: string; filePath: string } }) {
  return (
    <a
      href={`${api.defaults.baseURL}/uploads/${d.filePath}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
    >
      {d.fileName}
      <Download size={12} aria-hidden />
    </a>
  );
}

export function IsiUsulan({
  proyek,
  kegiatanId,
  judul,
}: {
  proyek: Proyek;
  kegiatanId: string | null;
  /** Judul bagian, sebaris dengan tombol Buka/Tutup semua. */
  judul?: React.ReactNode;
}) {
  const [tabs, setTabs] = useState<FormTabNode[] | null>(null);
  const [skor, setSkor] = useState<{ skorEvaluasi: number | null; rincian: Rincian[] } | null>(null);
  const [buka, setBuka] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!kegiatanId) return;
    api
      .get(`/master/form-template/${kegiatanId}?activeOnly=true`)
      .then((r) => setTabs(r.data.tabs ?? []))
      .catch(() => setTabs([]));
  }, [kegiatanId]);
  useEffect(() => {
    api
      .get(`/proyek/${proyek.id}/skor`)
      .then((r) => setSkor(r.data))
      .catch(() => setSkor(null));
  }, [proyek.id, proyek.updatedAt]);

  const isian = useMemo(() => fromFormValueRows(proyek.formValues), [proyek.formValues]);
  const paket = useMemo(() => proyek.paket ?? [], [proyek.paket]);
  const ringkas = useMemo(() => ringkasPaket(paket.flatMap(ringkasPaketServer)), [paket]);
  const semuaItem = (tabs ?? []).flatMap((t) => t.sections.flatMap((s) => s.items));
  const sourceData = useSourceData(semuaItem.map((i) => i.optionSource));
  const dokumen = proyek.dokumenPendukung ?? [];

  // Nilai mentah 1 kolom (bawaan = kolom proyek, tambahan = isian per kolom) — utk syarat tampil.
  const mentah = (key: string): unknown =>
    key in proyek ? (proyek as unknown as Record<string, unknown>)[key] : isian[key]?.value;

  const nilaiBawaan = (item: FormItemNode): Nilai | typeof LEWATI | undefined => {
    const p = proyek;
    switch (item.key) {
      case "balaiId": return p.balai?.name;
      case "periodeId": return p.periode?.label;
      case "projectName": return p.projectName;
      case "wilayahSungaiId": return p.wilayahSungai?.name;
      case "provinceId": {
        const w = [p.provinceName, p.cityName, p.districtName, p.villageName].filter(Boolean);
        return w.length ? w.join(" › ") : null;
      }
      case "cityId":
      case "longitude":
        return LEWATI; // sudah tercakup "Wilayah administratif" / koordinat
      case "latitude":
        if (p.tipeKoordinat === "TITIK" || (!p.tipeKoordinat && p.latitude != null))
          return p.latitude != null && p.longitude != null
            ? `Titik ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`
            : null;
        return p.coordinates?.length
          ? `${p.tipeKoordinat === "GARIS" ? "Garis" : "Poligon"} · ${p.coordinates.length} titik`
          : null;
      case "sumberUsulanProyek": return p.sumberUsulanProyek;
      case "sumberUsulanLainnya": return p.sumberUsulanLainnya;
      case "justifikasiProyek": return p.justifikasiProyek;
      case "statusStudiLayak":
      case "statusDed":
      case "statusLarap":
      case "statusDokumenLingkungan": {
        const st = p[item.key];
        if (!st) return null;
        const tahun = st === "TIDAK_PERLU" ? null : p[TAHUN_KRITERIA[item.key]];
        return (
          <>
            {labelOpsi(item, st, STATUS_KRITERIA[st] ?? st)} ·{" "}
            {tahun ? String(tahun) : <span className="text-muted-foreground">–</span>}
          </>
        );
      }
      case "kewenangan":
        return p.kewenangan ? labelOpsi(item, p.kewenangan, p.kewenangan === "PUSAT" ? "Pusat" : "Daerah") : null;
      case "kebutuhanTanah":
        return labelOpsi(item, String(p.kebutuhanTanah), p.kebutuhanTanah ? "Ada" : "Tidak ada");
      case "kegiatanPrioritasId": {
        const kp = p.kegiatanPrioritas;
        if (!kp) return null;
        const pp = kp.programPrioritas;
        return `PN ${pp.prioritasNasional.code} › PP ${pp.code} › KP ${kp.code} ${kp.name}`;
      }
      case "indikatorSasaranProgramId":
        return p.indikatorSasaranProgram
          ? `${p.indikatorSasaranProgram.sasaranProgram.name} › ${p.indikatorSasaranProgram.name}`
          : null;
      case "indikatorSasaranKegiatanId":
        return p.indikatorSasaranKegiatan
          ? `${p.indikatorSasaranKegiatan.sasaranKegiatan.name} › ${p.indikatorSasaranKegiatan.name}`
          : null;
      case "tematikRenjaId": return p.tematikRenja?.name;
      case "pkpnId": return p.pkpn?.name;
      case "fkb": return (p.fkb ?? []).join(", ") || null;
      case "fkw": return (p.fkw ?? []).join(", ") || null;
      case "mpa": return (p.mpa ?? []).join(", ") || null;
      case "taggingDinamis": return p.taggingDinamis?.length ? p.taggingDinamis.join(", ") : null;
      case "catatanPembina": return p.catatanPembina;
      case "catatanSspsda": return p.catatanSspsda;
      case "dokumenPendukung": {
        const umum = dokumen.filter((d) => !d.formItemId);
        return umum.length ? (
          <span className="flex flex-col gap-1">{umum.map((d) => <Berkas key={d.id} d={d} />)}</span>
        ) : null;
      }
      case "saldoVolumeRo": return ada(p.saldoVolumeRo) ? angka(Number(p.saldoVolumeRo)) : null;
      case "saldoVolumeIro": return ada(p.saldoVolumeIro) ? angka(Number(p.saldoVolumeIro)) : null;
      case "satkerBolehUbahPaket": return yaTidak(p.satkerBolehUbahPaket !== false);
      case "daftarPaket":
        return `${paket.length} paket · ${fmtRupiahRingkas(ringkas.A)} (lihat daftar Paket di atas)`;
    }
    return undefined; // bukan kolom bawaan
  };

  const nilaiTambahan = (item: FormItemNode): Nilai => {
    if (item.fieldType === "RASIO" || item.thresholdValue != null) {
      const info = teksRasio(item.rasio, item.thresholdValue, ringkas) as {
        teks?: string;
        pesan?: string;
        terpenuhi?: boolean;
      };
      if (!info.teks) return <span className="text-muted-foreground">{info.pesan ?? "–"}</span>;
      return (
        <>
          {info.teks}{" "}
          <span className={info.terpenuhi ? "font-medium text-ok" : "font-medium text-destructive"}>
            · {info.terpenuhi ? "Terpenuhi" : "Belum terpenuhi"}
          </span>
        </>
      );
    }
    if (item.fieldType === "UPLOAD") {
      const d = dokumen.find((x) => x.formItemId === item.id);
      return d ? <Berkas d={d} /> : null;
    }
    const v = isian[item.key];
    const rows = rowsForItem(item, sourceData, mentah, kegiatanId);
    const label = (x: unknown) =>
      rows?.find((r) => r.value === String(x))?.label ??
      item.options.find((o) => o.value === String(x))?.label ??
      String(x);
    if (item.fieldType === "CHECKBOX") {
      if (item.optionSource || item.options.length) {
        const arr = Array.isArray(v?.value) ? v!.value : v?.value != null ? [v.value] : [];
        return arr.length ? (arr as unknown[]).map(label).join(", ") : null;
      }
      return v?.value ? "Ya" : "Tidak";
    }
    if (!v || !ada(v.value)) return null;
    let teks: React.ReactNode;
    if (item.fieldType === "DROPDOWN") teks = label(v.value);
    else if (item.fieldType === "NUMBER") teks = angka(Number(v.value));
    else if (item.fieldType === "DATE")
      teks = new Date(String(v.value)).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    else teks = String(v.value);
    return v.note ? <>{teks} <span className="text-muted-foreground">· {v.note}</span></> : teks;
  };

  // Bagian/kolom tampil dengan syarat yang sama seperti di form.
  const tampil = (x: { conditionItemId?: string | null; conditionValue?: string | null }) =>
    !x.conditionItemId || kondisiTerpenuhi(x.conditionValue, mentah(x.conditionItemId));

  type Baris = { id: string; label: React.ReactNode; nilai: Nilai; anak?: boolean };
  const barisTab = (tab: FormTabNode): Baris[] => {
    const out: Baris[] = [];
    if (tab.key === "identitas" && proyek.kegiatan)
      out.push({ id: "kegiatan", label: "Kegiatan", nilai: `${proyek.kegiatan.code} · ${proyek.kegiatan.name}` });
    if (tab.key === "valuasi") {
      out.push(
        { id: "A", label: "A · Total anggaran", nilai: ringkas.A ? fmtRupiahRingkas(ringkas.A) : null },
        { id: "B", label: "B · Total volume RO (utama)", nilai: ringkas.B ? `${angka(ringkas.B)} ${ringkas.satuanB.join("/")}` : null },
        { id: "C", label: "C · Total volume IRO (utama)", nilai: ringkas.C ? `${angka(ringkas.C)} ${ringkas.satuanC.join("/")}` : null },
      );
    }
    for (const s of tab.sections) {
      if (s.perPaket || !tampil(s)) continue; // bagian per paket tampil di daftar Paket
      const keys = new Set(s.items.map((i) => i.key));
      const pohon = (item: FormItemNode, anak: boolean) => {
        if (!tampil(item)) return;
        const bawaan = nilaiBawaan(item);
        if (bawaan !== LEWATI) {
          const tambahan = bawaan === undefined;
          out.push({
            id: item.id,
            anak,
            label: (
              <>
                {item.label}
                {tambahan && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                    tambahan
                  </span>
                )}
              </>
            ),
            nilai: tambahan ? nilaiTambahan(item) : (bawaan as Nilai),
          });
        }
        s.items.filter((c) => c.conditionItemId === item.key).forEach((c) => pohon(c, true));
      };
      s.items.filter((i) => !i.conditionItemId || !keys.has(i.conditionItemId)).forEach((i) => pohon(i, false));
    }
    if (tab.key === "evaluasi" && skor) {
      out.push({
        id: "total",
        label: "Skor total",
        nilai: skor.skorEvaluasi != null ? <><b>{fmtSkor(Number(skor.skorEvaluasi) * 100)}</b> / 100</> : null,
      });
      for (const r of skor.rincian.filter((r) => r.bobot > 0))
        out.push({ id: `r-${r.key}`, label: r.label ?? r.key, nilai: `${fmtSkor(r.dapat)} / ${fmtSkor(r.bobot)}` });
    }
    return out;
  };

  if (!kegiatanId)
    return <p className="text-sm text-muted-foreground">Kegiatan proyek belum ditentukan, isi usulan belum bisa ditampilkan.</p>;
  if (kegiatanId && tabs === null) return <p className="text-sm text-muted-foreground">Memuat isi usulan…</p>;
  if (!tabs?.length)
    return <p className="text-sm text-muted-foreground">Form kegiatan ini belum disusun admin (Master Data › Form Proyek).</p>;

  const data = tabs.map((t) => ({ tab: t, baris: barisTab(t) }));
  const ringkasan = (t: FormTabNode, baris: Baris[]) => {
    if (t.key === "pemaketan") return `${paket.length} paket · ${fmtRupiahRingkas(ringkas.A)}`;
    if (t.key === "evaluasi")
      return skor?.skorEvaluasi != null ? `Skor ${fmtSkor(Number(skor.skorEvaluasi) * 100)} / 100` : "Belum dievaluasi";
    const kosong = baris.filter((b) => b.nilai == null || b.nilai === "").length;
    return `${baris.length} kolom${kosong ? ` · ${kosong} belum diisi` : ""}`;
  };
  const semuaBuka = buka.size === data.length;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-end gap-3">
        {judul}
        <button
          type="button"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setBuka(semuaBuka ? new Set() : new Set(data.map((d) => d.tab.key)))}
        >
          {semuaBuka ? "Tutup semua" : "Buka semua"}
        </button>
      </div>
      {data.map(({ tab, baris }) => {
        const o = buka.has(tab.key);
        const Ikon = IKON[tab.key] ?? FileText;
        return (
          <div key={tab.id} className={cn("overflow-hidden rounded-xl border bg-card", o && "shadow-sm")}>
            <button
              type="button"
              aria-expanded={o}
              onClick={() =>
                setBuka((cur) => {
                  const n = new Set(cur);
                  if (n.has(tab.key)) n.delete(tab.key);
                  else n.add(tab.key);
                  return n;
                })
              }
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                o && "border-b bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                  o ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <Ikon size={16} aria-hidden />
              </span>
              <span className="flex-1 text-sm font-semibold">{tab.label}</span>
              <span className="text-xs text-muted-foreground">{ringkasan(tab, baris)}</span>
              <ChevronDown
                size={16}
                className={cn("shrink-0 text-muted-foreground transition-transform", o && "rotate-180")}
                aria-hidden
              />
            </button>
            {o && (
              <dl className="px-4 pb-2 pl-[3.75rem] text-sm">
                {baris.length === 0 && <p className="py-3 text-muted-foreground">Tidak ada kolom di tab ini.</p>}
                {baris.map((b, i) => (
                  <div
                    key={b.id}
                    className={cn(
                      "grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-4",
                      i > 0 && "border-t border-dashed",
                    )}
                  >
                    <dt className={cn("text-muted-foreground", b.anak && "pl-4")}>{b.label}</dt>
                    <dd className="min-w-0 break-words">
                      {b.nilai == null || b.nilai === "" ? <span className="text-muted-foreground">–</span> : b.nilai}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}
