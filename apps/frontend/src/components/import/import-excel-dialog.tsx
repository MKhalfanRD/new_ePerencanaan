"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  X,
  AlertTriangle,
  Download,
  Info,
  ExternalLink,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { KolomTemplate, unduhTemplate } from "@/lib/template-excel";

interface MatchedBalai {
  excelName: string;
  balaiId: number;
  balaiName: string;
}
interface UnmatchedBalai {
  excelName: string;
  suggestions: { id: number; name: string; score: number }[];
}
interface NilaiAlokasi {
  tahun: number;
  komponen: string;
  volRo: number | null;
  volIro: number | null;
  rm: number;
  rmp: number;
  pln: number;
  sbsn: number;
  kpbu: number;
  total: number;
}
interface Duplikat {
  excelRowNumber: number;
  sheet: string;
  balaiName: string;
  namaProyek: string;
  namaPaket: string;
  tahun: number;
  alasan: string;
  sumberLama: string;
  lama: NilaiAlokasi;
  excel: NilaiAlokasi;
}
interface ParseError {
  excelRowNumber: number;
  sheet?: string;
  namaProyek: string;
  balaiName: string;
  reason: string;
}
interface PreviewResult {
  sessionId: string;
  summary: {
    totalRowsExcel: number;
    totalRowsValid: number;
    totalRowsError: number;
    totalProyek: number;
    totalProyekBaru: number;
    totalAlokasiBaru: number;
    totalDuplikat: number;
    totalBalaiTerdeteksi: number;
    totalBalaiMatched: number;
    totalBalaiUnmatched: number;
  };
  matched: MatchedBalai[];
  unmatched: UnmatchedBalai[];
  duplikat: Duplikat[];
  parseErrors: ParseError[];
  info: string[];
  /** Melebihi saldo kegiatan / tahun tanpa saldo — tetap boleh diimport. */
  peringatanSaldo: string[];
  rencana: RencanaProyek[];
  bolehBuatBalai: boolean;
}

interface RencanaProyek {
  namaProyek: string;
  balaiName: string;
  kegiatan: string;
  aksi: "baru" | "ditambah";
  proyekId: string | null;
  paket: { nama: string; baru: boolean; tahun: number[] }[];
}

interface HasilProyek {
  proyekId: string;
  kodeProyek: string;
  namaProyek: string;
  aksi: "baru" | "ditambah";
  paketBaru: number;
  alokasiBaru: number;
}

interface CommitResult {
  message: string;
  createdProyek: number;
  updatedProyek: number;
  createdPaket: number;
  createdAlokasi: number;
  skippedDuplikat: number;
  skipped: number;
  commitErrors: ParseError[];
  hasil: HasilProyek[];
}

type Resolution = {
  excelName: string;
  useExistingBalaiId?: number;
  createNew?: boolean;
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** lihatHasil = true: tampilkan daftar proyek dengan filter "Hasil import terakhir". */
  onSuccess: (lihatHasil?: boolean) => void;
}

const KOLOM_BANDING: [keyof NilaiAlokasi, string][] = [
  ["tahun", "Tahun"],
  ["komponen", "Komponen"],
  ["volRo", "Vol RO"],
  ["volIro", "Vol IRO"],
  ["rm", "RM"],
  ["rmp", "RMP"],
  ["pln", "PLN"],
  ["sbsn", "SBSN"],
  ["kpbu", "KPBU"],
  ["total", "Total"],
];
const tampilNilai = (k: keyof NilaiAlokasi, v: string | number | null) =>
  v == null || v === ""
    ? "-"
    : k === "tahun" || typeof v === "string"
      ? String(v)
      : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v);

// Sandingkan alokasi pembanding (sistem / baris Excel lain) dengan baris
// Excel yang duplikat; nilai yang berbeda disorot.
function TabelBanding({ d }: { d: Duplikat }) {
  return (
    <table className="w-full text-xs mt-2 border rounded">
      <thead className="bg-muted/50">
        <tr>
          <th className="text-left p-1.5 font-medium w-24"></th>
          <th className="text-left p-1.5 font-medium">{d.sumberLama}</th>
          <th className="text-left p-1.5 font-medium">
            Excel {d.sheet} baris #{d.excelRowNumber}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {KOLOM_BANDING.map(([k, label]) => {
          const beda = d.lama[k] !== d.excel[k];
          return (
            <tr key={k} className={beda ? "bg-warn/12" : undefined}>
              <td className="p-1.5 text-muted-foreground">{label}</td>
              <td className="p-1.5">{tampilNilai(k, d.lama[k])}</td>
              <td className={`p-1.5 ${beda ? "font-semibold text-warn-ink" : ""}`}>
                {tampilNilai(k, d.excel[k])}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Angka({ n, label, warna }: { n: number; label: string; warna?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5">
      <p className={cn("text-2xl font-bold tabular-nums", warna)}>{n.toLocaleString("id-ID")}</p>
      <p className="text-[13px] text-muted-foreground">{label}</p>
    </div>
  );
}

function RencanaPanel({ items }: { items: RencanaProyek[] }) {
  const [batas, setBatas] = useState(30);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="px-4 py-3">
        <p className="text-sm font-semibold">Rencana import ({items.length.toLocaleString("id-ID")} proyek)</p>
        <p className="text-xs text-muted-foreground">
          Belum ada data tersimpan. Periksa daftar ini, lalu klik Import sekarang
          untuk menyetujui.
        </p>
      </div>
      <ul className="divide-y border-t max-h-80 overflow-y-auto">
        {items.slice(0, batas).map((r, i) => (
          <li key={i} className="space-y-1 px-4 py-3 text-[13px]">
            <div className="flex items-start gap-2.5">
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs",
                  r.aksi === "baru" ? "bg-ok/10 text-ok" : "bg-info/10 text-info",
                )}
              >
                {r.aksi === "baru" ? "Proyek baru" : "Tambah tahun"}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.namaProyek}</p>
                <p className="text-muted-foreground truncate">
                  {r.balaiName} · kegiatan {r.kegiatan}
                </p>
              </div>
            </div>
            <ul className="space-y-0.5 pl-24 text-muted-foreground">
              {r.paket.map((pk, j) => (
                <li key={j} className="truncate">
                  {pk.baru ? "Paket baru" : "Tambah tahun"}: {pk.nama} ·{" "}
                  {pk.tahun.join(", ")}
                </li>
              ))}
            </ul>
          </li>
        ))}
        {items.length > batas && (
          <li className="p-2 text-center">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setBatas((b) => b + 30)}
            >
              Tampilkan lagi ({items.length - batas} tersisa)
            </Button>
          </li>
        )}
      </ul>
    </div>
  );
}

function DuplikatPanel({ items }: { items: Duplikat[] }) {
  const [buka, setBuka] = useState<number | null>(null);
  // File Renstra bisa ribuan duplikat — tampilkan bertahap.
  const [batas, setBatas] = useState(50);
  return (
    <div className="rounded-lg border border-warn/35 bg-warn/12 overflow-hidden">
      <div className="flex items-center gap-2 p-3">
        <AlertTriangle size={15} className="text-warn-ink" />
        <span className="text-sm font-medium text-warn-ink">
          {items.length} alokasi duplikat, tidak diimpor
        </span>
      </div>
      <ul className="divide-y border-t border-warn/35 bg-white max-h-80 overflow-y-auto">
        {items.slice(0, batas).map((d, i) => (
          <li key={i} className="p-2.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {d.sheet} #{d.excelRowNumber} · {d.namaPaket}
                </p>
                <p className="text-muted-foreground truncate">
                  {d.namaProyek} · {d.balaiName}
                </p>
                <p className="text-warn-ink mt-0.5">{d.alasan}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
                onClick={() => setBuka(buka === i ? null : i)}
              >
                {buka === i ? "Tutup" : "Lihat detail"}
              </Button>
            </div>
            {buka === i && <TabelBanding d={d} />}
          </li>
        ))}
        {items.length > batas && (
          <li className="p-2 text-center">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setBatas((b) => b + 50)}
            >
              Tampilkan lagi ({items.length - batas} tersisa)
            </Button>
          </li>
        )}
      </ul>
    </div>
  );
}

function downloadErrorsToExcel(errors: ParseError[], filename: string) {
  const rows = errors.map((e) => ({
    Sheet: e.sheet ?? "",
    "Baris Excel": e.excelRowNumber,
    "Nama Proyek": e.namaProyek,
    Balai: e.balaiName,
    "Alasan Gagal": e.reason,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 10 }, { wch: 12 }, { wch: 40 }, { wch: 30 }, { wch: 50 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Error");
  XLSX.writeFile(wb, `${filename}-${Date.now()}.xlsx`);
}

// Tabel error dengan pagination — supaya tidak crash render ribuan baris
function ErrorTable({
  errors,
  showBalai = true,
}: {
  errors: ParseError[];
  showBalai?: boolean;
}) {
  const [page, setPage] = useState(1);
  const perPage = 25;
  const totalPages = Math.ceil(errors.length / perPage);
  const pageData = useMemo(
    () => errors.slice((page - 1) * perPage, page * perPage),
    [errors, page],
  );

  return (
    <div>
      <div className="max-h-56 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-destructive/10">
            <tr>
              <th className="text-left p-2 font-medium">Baris</th>
              <th className="text-left p-2 font-medium">Proyek</th>
              {showBalai && (
                <th className="text-left p-2 font-medium">Balai</th>
              )}
              <th className="text-left p-2 font-medium">Alasan</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pageData.map((e, i) => (
              <tr key={i}>
                <td className="p-2 text-muted-foreground">
                  {e.sheet && `${e.sheet} `}#{e.excelRowNumber}
                </td>
                <td className="p-2 truncate max-w-[120px]">{e.namaProyek}</td>
                {showBalai && (
                  <td className="p-2 truncate max-w-[100px] text-muted-foreground">
                    {e.balaiName}
                  </td>
                )}
                <td className="p-2 text-destructive">{e.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-2 border-t bg-white">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs px-2"
            disabled={page === 1}
            onClick={() => setPage(1)}
            title="Halaman pertama"
          >
            <ChevronsLeft size={13} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Sebelumnya
          </Button>
          <span className="text-xs text-muted-foreground">
            Halaman {page} dari {totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs px-2"
            disabled={page === totalPages}
            onClick={() => setPage(totalPages)}
            title="Halaman terakhir"
          >
            <ChevronsRight size={13} />
          </Button>
        </div>
      )}
    </div>
  );
}

export function ImportExcelDialog({ open, onClose, onSuccess }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "balai" | "done">(
    "upload",
  );
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>(
    {},
  );
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [showParseErrors, setShowParseErrors] = useState(false);
  const [showCommitErrors, setShowCommitErrors] = useState(false);
  const reset = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResolutions({});
    setResult(null);
    setShowParseErrors(false);
    setShowCommitErrors(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("File harus berformat .xlsx atau .xls");
      return;
    }
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<PreviewResult>("/import/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(res.data);

      const initialResolutions: Record<string, Resolution> = {};
      for (const u of res.data.unmatched) {
        initialResolutions[u.excelName] =
          u.suggestions.length > 0
            ? {
                excelName: u.excelName,
                useExistingBalaiId: u.suggestions[0].id,
              }
            : res.data.bolehBuatBalai
              ? { excelName: u.excelName, createNew: true }
              : { excelName: u.excelName };
      }
      setResolutions(initialResolutions);

      setStep("balai");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memproses file Excel");
    } finally {
      setUploading(false);
    }
  };

  const handleResolutionChange = (excelName: string, value: string) => {
    if (value === "CREATE_NEW") {
      setResolutions((prev) => ({
        ...prev,
        [excelName]: { excelName, createNew: true },
      }));
    } else if (value === "SKIP") {
      setResolutions((prev) => ({ ...prev, [excelName]: { excelName } }));
    } else {
      setResolutions((prev) => ({
        ...prev,
        [excelName]: { excelName, useExistingBalaiId: Number(value) },
      }));
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setCommitting(true);
    try {
      const res = await api.post<CommitResult>("/import/commit", {
        sessionId: preview.sessionId,
        balaiResolutions: Object.values(resolutions),
      });
      setResult(res.data);
      setStep("done");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal melakukan import");
    } finally {
      setCommitting(false);
    }
  };

  const handleFinish = (lihatHasil?: boolean) => {
    onSuccess(lihatHasil);
    handleClose();
  };

  const bukaProyek = (id: string) => {
    handleFinish();
    router.push(`/proyek?id=${id}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent
        className="!max-w-3xl !w-[92vw] max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5">
          <div className="flex items-start gap-3 pr-8">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <FileText size={18} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold">Import proyek dari Excel</DialogTitle>
              <p className="text-[13.5px] text-muted-foreground">
                {step === "upload" && "Upload file Excel rekapitulasi rencana anggaran"}
                {step === "balai" && "Periksa balai & alokasi duplikat"}
                {step === "done" && "Import selesai"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* STEP: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div className="flex gap-2.5 rounded-xl bg-tier-1 px-4 py-3">
                <Info size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div className="space-y-2.5">
                <p className="text-[13.5px]">
                  Belum punya file? Unduh template, isi sheet pertama, lalu
                  upload di bawah. Penjelasan kolom ada di sheet
                  &quot;Petunjuk&quot;.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() =>
                      unduhTemplate({ nama: "template-import-proyek", kolom: KOLOM_DB })
                    }
                  >
                    <Download size={12} className="mr-1.5" /> Template format
                    lengkap
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() =>
                      unduhTemplate({
                        nama: "template-import-renstra",
                        kolom: KOLOM_RENSTRA,
                      })
                    }
                  >
                    <Download size={12} className="mr-1.5" /> Template format
                    Renstra
                  </Button>
                </div>
                </div>
              </div>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) handleFileSelect(f);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className="cursor-pointer rounded-xl border-[1.5px] border-dashed border-input p-12 text-center transition-colors outline-none hover:border-primary hover:bg-primary-soft/40 focus-visible:border-primary"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const s = e.target.files?.[0];
                    if (s) handleFileSelect(s);
                  }}
                />
                <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Upload size={20} />
                </span>
                <p className="text-sm font-semibold">
                  {file ? file.name : "Klik atau seret file Excel ke sini"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Format DB.xlsx (+ kolom Tahun) atau Kertas Kerja Renstra · .xlsx
                </p>
              </div>

              {file && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <FileSpreadsheet
                    size={18}
                    className="text-ok shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setFile(null)}
                  >
                    <X size={14} />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* STEP: Balai resolution */}
          {step === "balai" && preview && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Angka n={preview.summary.totalProyek} label="Total proyek" />
                <Angka n={preview.summary.totalProyekBaru} label="Proyek baru" warna="text-ok" />
                <Angka n={preview.summary.totalAlokasiBaru} label="Alokasi masuk" />
                <Angka n={preview.summary.totalDuplikat} label="Duplikat" warna="text-warn-ink" />
              </div>

              {preview.info.length > 0 && (
                <div className="rounded-lg border border-primary/30 bg-primary-soft p-3 flex gap-2.5">
                  <Info size={15} className="text-primary-ink shrink-0 mt-0.5" />
                  <ul className="text-xs text-primary-ink space-y-1">
                    {preview.info.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.peringatanSaldo?.length > 0 && (
                <div role="status" className="rounded-lg border border-warn/35 bg-warn/12 p-3 flex gap-2.5">
                  <AlertTriangle size={15} className="text-warn-ink shrink-0 mt-0.5" />
                  <div className="text-xs text-warn-ink space-y-1">
                    <p className="font-semibold">Saldo kegiatan: data tetap bisa diimport</p>
                    <ul className="space-y-1">
                      {preview.peringatanSaldo.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {preview.rencana.length > 0 && (
                <RencanaPanel items={preview.rencana} />
              )}

              {preview.duplikat.length > 0 && (
                <DuplikatPanel items={preview.duplikat} />
              )}

              {preview.summary.totalRowsError > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 overflow-hidden">
                  <button
                    onClick={() => setShowParseErrors(!showParseErrors)}
                    className="w-full flex items-center justify-between p-3 hover:bg-destructive/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={15} className="text-destructive" />
                      <span className="text-sm font-medium text-destructive">
                        {preview.summary.totalRowsError} baris tidak dapat
                        dibaca
                      </span>
                    </div>
                    <span className="text-xs text-destructive underline">
                      {showParseErrors ? "Tutup" : "Lihat detail"}
                    </span>
                  </button>
                  {showParseErrors && (
                    <div className="border-t border-destructive/30 bg-white">
                      <ErrorTable
                        errors={preview.parseErrors}
                        showBalai={false}
                      />
                      <div className="p-2 border-t border-destructive/30">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-8"
                          onClick={() =>
                            downloadErrorsToExcel(
                              preview.parseErrors,
                              "baris-gagal-dibaca",
                            )
                          }
                        >
                          <Download size={12} className="mr-1.5" /> Download
                          Daftar Error
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {preview.matched.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={14} className="text-ok" />
                    <p className="text-sm font-medium">
                      {preview.matched.length} balai cocok otomatis
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.matched.map((m) => (
                      <Badge
                        key={m.excelName}
                        variant="secondary"
                        className="text-xs"
                      >
                        {m.balaiName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {preview.unmatched.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle size={14} className="text-warn-ink" />
                    <p className="text-sm font-medium">
                      {preview.unmatched.length} balai perlu konfirmasi
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {preview.unmatched.map((u) => (
                      <div
                        key={u.excelName}
                        className="rounded-lg border p-3 space-y-2"
                      >
                        <p className="text-sm font-medium">{u.excelName}</p>
                        <Select
                          value={
                            resolutions[u.excelName]?.createNew
                              ? "CREATE_NEW"
                              : resolutions[
                                  u.excelName
                                ]?.useExistingBalaiId?.toString() || "SKIP"
                          }
                          onValueChange={(v) =>
                            handleResolutionChange(u.excelName, v)
                          }
                        >
                          <SelectTrigger className="w-full h-9 text-xs">
                            <SelectValue placeholder="Pilih tindakan" />
                          </SelectTrigger>
                          <SelectContent>
                            {u.suggestions.map((s) => (
                              <SelectItem key={s.id} value={s.id.toString()}>
                                Gunakan:{" "}
                                <span className="font-medium">{s.name}</span>
                                <span className="text-muted-foreground ml-1">
                                  ({Math.round(s.score * 100)}% mirip)
                                </span>
                              </SelectItem>
                            ))}
                            {preview.bolehBuatBalai && (
                              <SelectItem value="CREATE_NEW">
                                ➕ Buat balai baru: &quot;{u.excelName}&quot;
                              </SelectItem>
                            )}
                            <SelectItem value="SKIP">
                              Lewati proyek balai ini (minta admin tambah balai)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP: Done */}
          {step === "done" && result && (
            <div className="space-y-5">
              <div
                role="status"
                className={cn(
                  "flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13.5px]",
                  result.skipped > 0 ? "bg-warn/12 text-warn-ink" : "bg-ok/10 text-ok",
                )}
              >
                {result.skipped > 0 ? (
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                )}
                <p>
                  <b>{result.skipped > 0 ? "Import selesai dengan beberapa error." : "Import berhasil."}</b>{" "}
                  <span className="text-foreground">
                    {result.createdPaket.toLocaleString("id-ID")} paket baru,{" "}
                    {result.createdAlokasi.toLocaleString("id-ID")} alokasi masuk.
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Angka n={result.createdProyek} label="Proyek dibuat" warna="text-ok" />
                <Angka n={result.updatedProyek} label="Proyek diperbarui" />
                <Angka n={result.createdAlokasi} label="Alokasi baru" />
                <Angka n={result.skippedDuplikat} label="Duplikat dilewati" />
              </div>

              {result.hasil.length > 0 && (
                <div className="overflow-hidden rounded-xl border bg-card">
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <p className="text-sm font-semibold">Hasil import</p>
                    <span className="text-xs text-muted-foreground">
                      {result.hasil.length.toLocaleString("id-ID")} proyek
                    </span>
                  </div>
                  <ul className="divide-y border-t max-h-64 overflow-y-auto">
                    {result.hasil.slice(0, 200).map((h) => (
                      <li
                        key={h.proyekId}
                        className="flex items-center gap-3 px-4 py-2.5 text-[13px]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{h.namaProyek}</p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-mono">{h.kodeProyek}</span> ·{" "}
                            {h.aksi === "baru" ? "dibuat" : "diperbarui"} · {h.paketBaru} paket baru ·{" "}
                            {h.alokasiBaru} alokasi
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0 text-xs"
                          onClick={() => bukaProyek(h.proyekId)}
                        >
                          <ExternalLink size={12} className="mr-1" /> Buka
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {result.hasil.length > 200 && (
                    <p className="p-2 text-center text-xs text-muted-foreground border-t">
                      {result.hasil.length - 200} proyek lainnya ada di daftar
                      proyek (filter Hasil import terakhir).
                    </p>
                  )}
                </div>
              )}

              {result.skipped > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 overflow-hidden">
                  <button
                    onClick={() => setShowCommitErrors(!showCommitErrors)}
                    className="w-full flex items-center justify-between p-3 hover:bg-destructive/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={15} className="text-destructive" />
                      <span className="text-sm font-medium text-destructive">
                        Lihat {result.skipped} data error
                      </span>
                    </div>
                    <span className="text-xs text-destructive underline">
                      {showCommitErrors ? "Tutup" : "Lihat detail"}
                    </span>
                  </button>
                  {showCommitErrors && (
                    <div className="border-t border-destructive/30 bg-white">
                      <ErrorTable errors={result.commitErrors} />
                      <div className="p-2 border-t border-destructive/30">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-8"
                          onClick={() =>
                            downloadErrorsToExcel(
                              result.commitErrors,
                              "data-error-saat-import",
                            )
                          }
                        >
                          <Download size={12} className="mr-1.5" /> Download
                          Daftar Error
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Batal
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
              >
                {uploading && <Loader2 size={15} className="mr-2 animate-spin" />}
                {uploading ? "Memproses…" : "Lanjutkan"}
                {!uploading && <ChevronRight size={15} className="ml-1" />}
              </Button>
            </>
          )}
          {step === "balai" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                <ChevronLeft size={15} className="mr-1" /> Kembali
              </Button>
              <Button
                onClick={handleCommit}
                disabled={committing || preview?.summary.totalAlokasiBaru === 0}
              >
                {committing && (
                  <Loader2 size={15} className="mr-2 animate-spin" />
                )}
                {committing ? "Mengimpor…" : "Import sekarang"}
              </Button>
            </>
          )}
          {step === "done" && (
            <>
              <Button variant="outline" onClick={() => handleFinish()}>
                Tutup
              </Button>
              {!!result?.hasil.length && (
                <Button onClick={() => handleFinish(true)}>
                  Lihat di daftar proyek
                  <ChevronRight size={15} className="ml-1" />
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Format lengkap: urutan kolom = posisi yang dibaca backend (COL di
// import.service.ts), lalu kolom Tahun di paling kanan (dicari lewat nama).
const W = { wajib: true };
const KOLOM_DB: KolomTemplate[] = [
  { label: "KodeProyek", keterangan: "Kosong = dibuat otomatis. Baris lanjutan proyek yang sama: kolom proyek boleh kosong" },
  { label: "Nama Proyek", ...W, contoh: "Bendungan A" },
  { label: "KdBalai", ...W, contoh: 1, keterangan: "ID balai (kdbalai)" },
  { label: "Balai", contoh: "BALAI WILAYAH SUNGAI SUMATERA I" },
  { label: "Kewenangan", contoh: "PUSAT" },
  { label: "Pola_Rencana (sebelum studi layak)" },
  { label: "StudiLayak", contoh: 2020, keterangan: "Tahun" },
  { label: "DED", contoh: 2022, keterangan: "Tahun" },
  { label: "LARAP", contoh: 2025, keterangan: "Tahun" },
  { label: "ButuhTanah", contoh: "Tidak memerlukan lahan" },
  { label: "Sumber Usulan Proyek", contoh: "Pemerintah Daerah" },
  { label: "Keterangan" },
  { label: "KodePaket", keterangan: "Kosong = dikenali lewat nama paket" },
  { label: "KdKegiatan", ...W, contoh: 7693 },
  { label: "KdKRO", ...W, contoh: "CBR" },
  { label: "namaRO. Nomenklatur", keterangan: "Tidak dibaca" },
  { label: "kdRO", ...W, contoh: "001" },
  { label: "namaRO" },
  { label: "KdKomponen", contoh: 103 },
  { label: "NmKomponen", contoh: "Konstruksi Pembangunan" },
  { label: "NamaPaket", ...W, contoh: "Pembangunan Bendungan A Paket I" },
  { label: "Jenis Paket (F/NF)", ...W, contoh: "F" },
  { label: "MasaLaksana", ...W, contoh: "Single Year", keterangan: "Single Year / Multi Year" },
  { label: "VolOutput", contoh: 1 },
  { label: "OutputSatuan", contoh: "Unit" },
  { label: "VolOutcome", contoh: 1 },
  { label: "OutcomeSatuan", contoh: "Unit" },
  { label: "KotaKabupaten" },
  { label: "DokLing" },
  { label: "Catatan Pembina" },
  { label: "Catatan SSPSDA" },
  { label: "PN" },
  { label: "PP" },
  { label: "KP" },
  { label: "PKPN" },
  { label: "SP" },
  { label: "ISP" },
  { label: "Satuan ISP" },
  { label: "SK" },
  { label: "ISK" },
  { label: "Satuan ISK" },
  { label: "IRO" },
  { label: "Satuan IRO" },
  { label: "Tematik RENJA" },
  { label: "FKB", keterangan: "Isi apa saja = ya" },
  { label: "FKW", keterangan: "Isi apa saja = ya" },
  { label: "MPA", keterangan: "Isi apa saja = ya" },
  { label: "KodeWS", contoh: "01.09.A2" },
  { label: "NamaWilayahSungai", contoh: "Alas-Singkil" },
  { label: "kab/kota" },
  { label: "kecamatan" },
  { label: "Long", contoh: 95.3363 },
  { label: "Lat", contoh: 5.5408 },
  { label: "SumberDana_RM", contoh: 2500000000 },
  { label: "SumberDana_RMP" },
  { label: "SumberDana_PLN" },
  { label: "SumberDana_SBSN" },
  { label: "SumberDana_KPBU" },
  { label: "SumberDanaAll", keterangan: "Total; kosong = dijumlah otomatis" },
  { label: "Tahun", ...W, contoh: 2026, keterangan: "Tahun alokasi" },
];

// Format Renstra: kolom dicari lewat nama header; tanpa kolom paket
// (1 proyek = 1 paket bernama sama, Jumlah dicatat sebagai RM).
const KOLOM_RENSTRA: KolomTemplate[] = [
  { label: "TA", ...W, contoh: 2026, keterangan: "Tahun anggaran" },
  { label: "BALAI", ...W, contoh: "BALAI WILAYAH SUNGAI SUMATERA I" },
  { label: "kdgiat", ...W, contoh: 7692 },
  { label: "kdKRO", ...W, contoh: "CBS" },
  { label: "kdRO", ...W, contoh: 3 },
  { label: "Nama Proyek", ...W, contoh: "Pembangunan Prasarana Pengaman Pantai" },
  { label: "Provinsi", contoh: "Aceh" },
  { label: "V OUTPUT", contoh: 0.5 },
  { label: "Sat RO", contoh: "Km" },
  { label: "IRO", contoh: 5.66 },
  { label: "Sat IRO", contoh: "Ha" },
  { label: "Jumlah", ...W, contoh: 25000000000, keterangan: "Dicatat sebagai sumber dana RM" },
  { label: "SK" },
  { label: "ISK" },
  { label: "SP" },
  { label: "ISP" },
];
