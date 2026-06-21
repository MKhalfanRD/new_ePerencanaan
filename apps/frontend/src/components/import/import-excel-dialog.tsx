"use client";

import { useState, useRef, useMemo } from "react";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  AlertTriangle,
  Download,
  Copy,
  RefreshCw,
  SkipForward,
  Search,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";

interface MatchedBalai {
  excelName: string;
  balaiId: number;
  balaiName: string;
}
interface UnmatchedBalai {
  excelName: string;
  suggestions: { id: number; name: string; score: number }[];
}
interface ExistingPlanning {
  groupKey: string;
  namaProyek: string;
  balaiName: string;
  existingId: string;
  existingAlokasiCount: number;
  existingTotal: number;
  newAlokasiCount: number;
  newTotal: number;
}
interface ParseError {
  sheetName: string;
  excelRowNumber: number;
  namaProyek: string;
  balaiName: string;
  tahun: number;
  reason: string;
}

interface PreviewResult {
  sessionId: string;
  summary: {
    totalRowsExcel: number;
    totalRowsValid: number;
    totalRowsError: number;
    totalPlanning: number;
    totalPlanningBaru: number;
    totalPlanningDuplikat: number;
    totalBalaiTerdeteksi: number;
    totalBalaiMatched: number;
    totalBalaiUnmatched: number;
  };
  matched: MatchedBalai[];
  unmatched: UnmatchedBalai[];
  existingPlannings: ExistingPlanning[];
  parseErrors: ParseError[];
}

interface CommitResult {
  message: string;
  createdPlanning: number;
  updatedPlanning: number;
  skippedPlanning: number;
  createdAlokasi: number;
  skipped: number;
  commitErrors: ParseError[];
}

type Resolution = {
  excelName: string;
  useExistingBalaiId?: number;
  createNew?: boolean;
};
type PlanningAction = "skip" | "replace";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const formatRupiah = (val: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(val);

function downloadErrorsToExcel(errors: ParseError[], filename: string) {
  const rows = errors.map((e) => ({
    Sheet: e.sheetName,
    "Baris Excel": e.excelRowNumber,
    "Nama Proyek": e.namaProyek,
    Balai: e.balaiName,
    Tahun: e.tahun || "-",
    "Alasan Gagal": e.reason,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 10 },
    { wch: 12 },
    { wch: 40 },
    { wch: 30 },
    { wch: 8 },
    { wch: 50 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Error");
  XLSX.writeFile(wb, `${filename}-${Date.now()}.xlsx`);
}

// Tabel error dengan pagination — supaya tidak crash render ribuan baris
function ErrorTable({
  errors,
  showBalaiTahun = true,
}: {
  errors: ParseError[];
  showBalaiTahun?: boolean;
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
          <thead className="sticky top-0 bg-red-50">
            <tr>
              <th className="text-left p-2 font-medium">Sheet</th>
              <th className="text-left p-2 font-medium">Baris</th>
              <th className="text-left p-2 font-medium">Proyek</th>
              {showBalaiTahun && (
                <th className="text-left p-2 font-medium">Balai</th>
              )}
              {showBalaiTahun && (
                <th className="text-left p-2 font-medium">Tahun</th>
              )}
              <th className="text-left p-2 font-medium">Alasan</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pageData.map((e, i) => (
              <tr key={i}>
                <td className="p-2 text-muted-foreground">{e.sheetName}</td>
                <td className="p-2 text-muted-foreground">
                  #{e.excelRowNumber}
                </td>
                <td className="p-2 truncate max-w-[120px]">{e.namaProyek}</td>
                {showBalaiTahun && (
                  <td className="p-2 truncate max-w-[100px] text-muted-foreground">
                    {e.balaiName}
                  </td>
                )}
                {showBalaiTahun && <td className="p-2">{e.tahun || "-"}</td>}
                <td className="p-2 text-red-600">{e.reason}</td>
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
        </div>
      )}
    </div>
  );
}

export function ImportExcelDialog({ open, onClose, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "balai" | "duplicate" | "done">(
    "upload",
  );
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>(
    {},
  );
  const [planningActions, setPlanningActions] = useState<
    Record<string, PlanningAction>
  >({});
  const [duplicatePage, setDuplicatePage] = useState(1);
  const [duplicateSearch, setDuplicateSearch] = useState("");
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [showParseErrors, setShowParseErrors] = useState(false);
  const [showCommitErrors, setShowCommitErrors] = useState(false);

  const duplicatePerPage = 10;

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResolutions({});
    setPlanningActions({});
    setDuplicatePage(1);
    setDuplicateSearch("");
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
            : { excelName: u.excelName, createNew: true };
      }
      setResolutions(initialResolutions);

      // Default semua planning duplikat: skip
      const initialActions: Record<string, PlanningAction> = {};
      for (const ep of res.data.existingPlannings) {
        initialActions[ep.groupKey] = "skip";
      }
      setPlanningActions(initialActions);

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
    } else {
      setResolutions((prev) => ({
        ...prev,
        [excelName]: { excelName, useExistingBalaiId: Number(value) },
      }));
    }
  };

  const handleNextFromBalai = () => {
    if (preview && preview.existingPlannings.length > 0) {
      setStep("duplicate");
    } else {
      handleCommit();
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setCommitting(true);
    try {
      const planningResolutions = Object.entries(planningActions).map(
        ([groupKey, action]) => ({
          groupKey,
          action,
        }),
      );

      const res = await api.post<CommitResult>("/import/commit", {
        sessionId: preview.sessionId,
        balaiResolutions: Object.values(resolutions),
        planningResolutions,
      });
      setResult(res.data);
      setStep("done");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal melakukan import");
    } finally {
      setCommitting(false);
    }
  };

  const handleFinish = () => {
    onSuccess();
    handleClose();
  };

  const setAllPlanningAction = (action: PlanningAction) => {
    if (!preview) return;
    const newActions: Record<string, PlanningAction> = {};
    for (const ep of preview.existingPlannings)
      newActions[ep.groupKey] = action;
    setPlanningActions(newActions);
  };

  const filteredExistingPlannings = useMemo(() => {
    if (!preview) return [];
    if (!duplicateSearch.trim()) return preview.existingPlannings;
    const q = duplicateSearch.toLowerCase();
    return preview.existingPlannings.filter(
      (ep) =>
        ep.namaProyek.toLowerCase().includes(q) ||
        ep.balaiName.toLowerCase().includes(q),
    );
  }, [preview, duplicateSearch]);

  const duplicateTotalPages = Math.ceil(
    filteredExistingPlannings.length / duplicatePerPage,
  );
  const duplicatePageData = filteredExistingPlannings.slice(
    (duplicatePage - 1) * duplicatePerPage,
    duplicatePage * duplicatePerPage,
  );

  const replaceCount = Object.values(planningActions).filter(
    (a) => a === "replace",
  ).length;
  const skipCount = Object.values(planningActions).filter(
    (a) => a === "skip",
  ).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent
        className="max-w-2xl w-[90vw] max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-7 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-primary" />
            Import Planning dari Excel
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "upload" &&
              "Upload file Excel rekapitulasi rencana anggaran"}
            {step === "balai" && "Periksa hasil pemetaan data balai"}
            {step === "duplicate" &&
              "Beberapa planning sudah ada di sistem — pilih tindakan"}
            {step === "done" && "Import telah selesai diproses"}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-7 py-6">
          {/* STEP: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) handleFileSelect(f);
                }}
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
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
                <Upload
                  size={32}
                  className="mx-auto mb-3 text-muted-foreground"
                />
                <p className="text-sm font-medium">
                  {file ? file.name : "Klik atau seret file Excel ke sini"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Format .xlsx atau .xls, sheet 7691/7692/7693/7694
                </p>
              </div>

              {file && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <FileSpreadsheet
                    size={18}
                    className="text-green-600 shrink-0"
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

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex gap-2.5">
                <Sparkles size={15} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Sistem akan mendeteksi proyek baru maupun yang sudah ada, lalu
                  meminta konfirmasi sebelum data disimpan.
                </p>
              </div>
            </div>
          )}

          {/* STEP: Balai resolution */}
          {step === "balai" && preview && (
            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">
                    {preview.summary.totalPlanning}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Total Planning
                  </p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {preview.summary.totalPlanningBaru}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Baru</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">
                    {preview.summary.totalPlanningDuplikat}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sudah Ada
                  </p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">
                    {preview.summary.totalRowsValid}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Alokasi Valid
                  </p>
                </div>
              </div>

              {preview.summary.totalRowsError > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 overflow-hidden">
                  <button
                    onClick={() => setShowParseErrors(!showParseErrors)}
                    className="w-full flex items-center justify-between p-3 hover:bg-red-100/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={15} className="text-red-600" />
                      <span className="text-sm font-medium text-red-700">
                        {preview.summary.totalRowsError} baris tidak dapat
                        dibaca
                      </span>
                    </div>
                    <span className="text-xs text-red-600 underline">
                      {showParseErrors ? "Tutup" : "Lihat detail"}
                    </span>
                  </button>
                  {showParseErrors && (
                    <div className="border-t border-red-200 bg-white">
                      <ErrorTable
                        errors={preview.parseErrors}
                        showBalaiTahun={false}
                      />
                      <div className="p-2 border-t border-red-200">
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
                    <CheckCircle2 size={14} className="text-green-600" />
                    <p className="text-sm font-medium">
                      {preview.matched.length} Balai Cocok Otomatis
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
                    <AlertCircle size={14} className="text-amber-600" />
                    <p className="text-sm font-medium">
                      {preview.unmatched.length} Balai Perlu Konfirmasi
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
                                ]?.useExistingBalaiId?.toString() || ""
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
                            <SelectItem value="CREATE_NEW">
                              ➕ Buat balai baru: &quot;{u.excelName}&quot;
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

          {/* STEP: Duplicate planning resolution */}
          {step === "duplicate" && preview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground shrink-0">
                  <span className="text-amber-600 font-medium">
                    {skipCount} pakai lama
                  </span>
                  ,
                  <span className="text-blue-600 font-medium">
                    {" "}
                    {replaceCount} diganti baru
                  </span>
                </p>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setAllPlanningAction("skip")}
                  >
                    <SkipForward size={12} className="mr-1.5" /> Skip Semua
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setAllPlanningAction("replace")}
                  >
                    <RefreshCw size={12} className="mr-1.5" /> Replace Semua
                  </Button>
                </div>
              </div>

              {/* Search box */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="Cari nama proyek atau balai..."
                  value={duplicateSearch}
                  onChange={(e) => {
                    setDuplicateSearch(e.target.value);
                    setDuplicatePage(1);
                  }}
                  className="pl-9 h-9 text-sm"
                />
                {duplicateSearch && (
                  <button
                    onClick={() => {
                      setDuplicateSearch("");
                      setDuplicatePage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {duplicateSearch && (
                <p className="text-xs text-muted-foreground">
                  {filteredExistingPlannings.length} hasil ditemukan untuk
                  &quot;{duplicateSearch}&quot;
                </p>
              )}

              <div className="space-y-2.5">
                {duplicatePageData.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Search size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      Tidak ada planning yang cocok dengan pencarian
                    </p>
                  </div>
                ) : (
                  duplicatePageData.map((ep) => {
                    const action = planningActions[ep.groupKey] ?? "skip";
                    return (
                      <div
                        key={ep.groupKey}
                        className="rounded-lg border p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {ep.namaProyek}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {ep.balaiName}
                            </p>
                          </div>
                          <Badge
                            variant={
                              action === "replace" ? "default" : "secondary"
                            }
                            className="text-xs shrink-0"
                          >
                            <Copy size={10} className="mr-1" /> Duplikat
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded bg-muted/40 p-2">
                            <p className="text-muted-foreground">Data Lama</p>
                            <p className="font-medium">
                              {ep.existingAlokasiCount} alokasi · Rp{" "}
                              {formatRupiah(ep.existingTotal)}
                            </p>
                          </div>
                          <div className="rounded bg-blue-50 p-2">
                            <p className="text-muted-foreground">
                              Data Baru (Excel)
                            </p>
                            <p className="font-medium">
                              {ep.newAlokasiCount} alokasi · Rp{" "}
                              {formatRupiah(ep.newTotal)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() =>
                              setPlanningActions((p) => ({
                                ...p,
                                [ep.groupKey]: "skip",
                              }))
                            }
                            className={`text-xs font-medium py-2 rounded-lg border transition-colors ${
                              action === "skip"
                                ? "bg-amber-100 border-amber-400 text-amber-700"
                                : "border-border hover:bg-muted/40"
                            }`}
                          >
                            Pakai Data Lama
                          </button>
                          <button
                            onClick={() =>
                              setPlanningActions((p) => ({
                                ...p,
                                [ep.groupKey]: "replace",
                              }))
                            }
                            className={`text-xs font-medium py-2 rounded-lg border transition-colors ${
                              action === "replace"
                                ? "bg-blue-100 border-blue-400 text-blue-700"
                                : "border-border hover:bg-muted/40"
                            }`}
                          >
                            Ganti dengan Baru
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {duplicateTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={duplicatePage === 1}
                    onClick={() => setDuplicatePage((p) => p - 1)}
                  >
                    Sebelumnya
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Halaman {duplicatePage} dari {duplicateTotalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={duplicatePage === duplicateTotalPages}
                    onClick={() => setDuplicatePage((p) => p + 1)}
                  >
                    Berikutnya
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* STEP: Done */}
          {step === "done" && result && (
            <div className="space-y-5">
              <div className="text-center py-4 space-y-3">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                    result.skipped > 0 ? "bg-amber-100" : "bg-green-100"
                  }`}
                >
                  {result.skipped > 0 ? (
                    <AlertTriangle size={32} className="text-amber-600" />
                  ) : (
                    <CheckCircle2 size={32} className="text-green-600" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    {result.skipped > 0
                      ? "Import Selesai (dengan beberapa error)"
                      : "Import Berhasil!"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Data dari Excel telah diproses ke dalam sistem
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xl font-bold text-green-600">
                    {result.createdPlanning}
                  </p>
                  <p className="text-xs text-muted-foreground">Baru</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xl font-bold text-blue-600">
                    {result.updatedPlanning}
                  </p>
                  <p className="text-xs text-muted-foreground">Diganti</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xl font-bold text-amber-600">
                    {result.skippedPlanning}
                  </p>
                  <p className="text-xs text-muted-foreground">Di-skip</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p
                    className={`text-xl font-bold ${result.skipped > 0 ? "text-red-600" : "text-muted-foreground"}`}
                  >
                    {result.skipped}
                  </p>
                  <p className="text-xs text-muted-foreground">Error</p>
                </div>
              </div>

              {result.skipped > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 overflow-hidden">
                  <button
                    onClick={() => setShowCommitErrors(!showCommitErrors)}
                    className="w-full flex items-center justify-between p-3 hover:bg-red-100/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={15} className="text-red-600" />
                      <span className="text-sm font-medium text-red-700">
                        Lihat {result.skipped} data error
                      </span>
                    </div>
                    <span className="text-xs text-red-600 underline">
                      {showCommitErrors ? "Tutup" : "Lihat detail"}
                    </span>
                  </button>
                  {showCommitErrors && (
                    <div className="border-t border-red-200 bg-white">
                      <ErrorTable errors={result.commitErrors} />
                      <div className="p-2 border-t border-red-200">
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

        <DialogFooter className="px-7 py-5 border-t shrink-0 bg-background">
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Batal
              </Button>
              <Button onClick={handleUpload} disabled={!file || uploading}>
                {uploading ? (
                  <Loader2 size={15} className="mr-2 animate-spin" />
                ) : (
                  <ArrowRight size={15} className="mr-2" />
                )}
                {uploading ? "Memproses..." : "Lanjutkan"}
              </Button>
            </>
          )}
          {step === "balai" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                <ArrowLeft size={15} className="mr-2" /> Kembali
              </Button>
              <Button onClick={handleNextFromBalai} disabled={committing}>
                {committing && (
                  <Loader2 size={15} className="mr-2 animate-spin" />
                )}
                {preview && preview.existingPlannings.length > 0
                  ? "Lanjutkan"
                  : committing
                    ? "Mengimpor..."
                    : "Import Sekarang"}
                {preview && preview.existingPlannings.length > 0 && (
                  <ArrowRight size={15} className="ml-2" />
                )}
              </Button>
            </>
          )}
          {step === "duplicate" && (
            <>
              <Button variant="outline" onClick={() => setStep("balai")}>
                <ArrowLeft size={15} className="mr-2" /> Kembali
              </Button>
              <Button onClick={handleCommit} disabled={committing}>
                {committing && (
                  <Loader2 size={15} className="mr-2 animate-spin" />
                )}
                {committing ? "Mengimpor..." : "Import Sekarang"}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={handleFinish} className="w-full">
              Selesai
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
