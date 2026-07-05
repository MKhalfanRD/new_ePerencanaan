"use client";

import { useState } from "react";
import {
  Edit,
  Send,
  CheckCircle,
  XCircle,
  RotateCcw,
  Loader2,
  Calendar,
  Building2,
  FileText,
  ChevronDown,
  AlertTriangle,
  FileDown,
  FileSpreadsheet,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetBreadcrumb,
  sheetPushedProps,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Planning, Alokasi } from "@/types";
import {
  exportPlanningDetailToExcel,
  exportPlanningDetailToPDF,
} from "@/lib/export-utils";
import { AlokasiFormDialog } from "./alokasi-form-dialog";
import { AlokasiExpandPanel } from "./alokasi-expand-panel";
import {
  statusConfig,
  dokumenStatusConfig,
  alokasiStatusConfig,
} from "@/components/shared/status-config";

const formatRupiah = (val: string | number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(val));

// Format ringkas ala mockup drawer ("Rp 12,0 M" / "Rp 500 jt") — beda dari
// formatRupiahShort di plannings/page.tsx (yang tanpa "Rp"/koma, mis.
// "12.0M") karena drawer & list memang punya konvensi berbeda di mockup.
const formatRupiahShort = (val: number) => {
  if (val >= 1_000_000_000) {
    const m = (val / 1_000_000_000).toLocaleString("id-ID", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `Rp ${m} M`;
  }
  if (val >= 1_000_000) {
    const jt = (val / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 0,
    });
    return `Rp ${jt} jt`;
  }
  if (val === 0) return "-";
  return formatRupiah(val);
};

// Kode identitas ringkas per proyek (mis. "BWS.07.7755") — logic sama
// persis dengan `getPlanningKode` di plannings/page.tsx, supaya kode yang
// tampil di baris list & di header drawer selalu konsisten.
const getPlanningKode = (p: Planning) => {
  const a = p.alokasi[0];
  const balaiCode = p.balai.code || p.balai.shortName || "-";
  const programCode = a?.ro?.kro?.kegiatan?.program?.code || "-";
  const kegiatanCode = a?.ro?.kro?.kegiatan?.code || "-";
  return `${balaiCode}.${programCode}.${kegiatanCode}`;
};

function InfoStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-sm font-semibold mt-0.5 ${valueClassName ?? ""}`}>
        {value}
      </p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon?: any; title: string }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={14} className="text-muted-foreground" />}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

interface Props {
  open: boolean;
  planning: Planning;
  onClose: () => void;
  onEdit: (p: Planning) => void;
  onRefresh: () => void;
}

export function PlanningDetailSheet({
  open,
  planning,
  onClose,
  onEdit,
  onRefresh,
}: Props) {
  const { user } = useAuthStore();
  const [reviewAction, setReviewAction] = useState("");
  const [reviewCatatan, setReviewCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAlokasiForm, setShowAlokasiForm] = useState(false);
  const [editAlokasi, setEditAlokasi] = useState<Alokasi | null>(null);
  const [deleteAlokasiId, setDeleteAlokasiId] = useState<string | null>(null);
  const [deletingAlokasi, setDeletingAlokasi] = useState(false);
  // Baris alokasi yang sedang expand — pengganti `detailAlokasiId` +
  // AlokasiDetailDialog (modal ke-2) lama. Bisa lebih dari satu terbuka.
  const [expandedAlokasi, setExpandedAlokasi] = useState<Set<string>>(
    new Set(),
  );

  // Koordinasi "activeSubDrawer" (§ Fase 3): dilacak sebagai kumpulan id
  // alokasi yang sedang punya Sheet lapis-2 terbuka (form Edit Alokasi atau
  // form Lokasi di dalam AlokasiExpandPanel), digabung dengan form
  // Tambah/Edit Alokasi yang dibuka langsung dari toolbar di sini. Sheet
  // lapis-1 diberi efek "pushed" selama salah satu dari itu terbuka.
  const [panelsWithSubDrawer, setPanelsWithSubDrawer] = useState<Set<string>>(
    new Set(),
  );
  const handleSubDrawerOpenChange = (alokasiId: string, isOpen: boolean) => {
    setPanelsWithSubDrawer((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(alokasiId);
      else next.delete(alokasiId);
      return next;
    });
  };
  const pushed = showAlokasiForm || panelsWithSubDrawer.size > 0;

  const toggleAlokasi = (id: string) => {
    setExpandedAlokasi((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canEdit =
    (user?.role === "SATKER" || user?.role === "ADMINISTRATOR") &&
    (planning.status === "DRAFT" || planning.status === "REVISION");

  const canSubmit =
    user?.role === "SATKER" &&
    (planning.status === "DRAFT" || planning.status === "REVISION");

  const canReview =
    (user?.role === "VERIFICATOR" || user?.role === "ADMINISTRATOR") &&
    planning.status === "SUBMITTED";

  const canManageAlokasi =
    (user?.role === "SATKER" || user?.role === "ADMINISTRATOR") &&
    (planning.status === "DRAFT" || planning.status === "REVISION");

  const handleDeleteAlokasi = async () => {
    if (!deleteAlokasiId) return;
    setDeletingAlokasi(true);
    try {
      await api.delete(`/alokasi/${deleteAlokasiId}`);
      toast.success("Alokasi berhasil dihapus");
      setDeleteAlokasiId(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus alokasi");
    } finally {
      setDeletingAlokasi(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/plannings/${planning.id}/submit`);
      toast.success("Planning berhasil diajukan");
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengajukan planning");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async () => {
    if (!reviewAction) return toast.error("Pilih aksi review terlebih dahulu");
    setSubmitting(true);
    try {
      await api.patch(`/plannings/${planning.id}/review`, {
        action: reviewAction,
        catatan: reviewCatatan,
      });
      toast.success("Review berhasil disimpan");
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan review");
    } finally {
      setSubmitting(false);
    }
  };

  const cfg = statusConfig[planning.status];

  const alokasiByTahun = planning.alokasi.reduce<
    Record<number, typeof planning.alokasi>
  >((acc, a) => {
    if (!acc[a.tahun]) acc[a.tahun] = [];
    acc[a.tahun].push(a);
    return acc;
  }, {});

  // Data turunan utk kartu "Info Proyek" ringkas (6-item, sesuai mockup).
  // RO ditentukan dari alokasi pertama karena Planning sendiri tidak
  // langsung menyimpan Program/Kegiatan/KRO/RO (itu melekat di tiap
  // alokasi) — sama seperti logic `getPlanningKode`.
  const firstRo = planning.alokasi[0]?.ro;
  const isPrioritasNasional =
    planning.prioritas.some((p) => p.proyekPrioritas) ||
    planning.majorProjects.length > 0;
  const majorProjectName = planning.majorProjects[0]?.majorProject.name;
  // Mockup menampilkan 2 kriteria dokumen kunci (DED & AMDAL). Data
  // sebenarnya tidak punya jenis literal "AMDAL" — yang paling dekat
  // adalah "Dokumen Lingkungan" (AMDAL termasuk di dalamnya), jadi
  // dipetakan ke situ, bukan dipaksakan jadi label "AMDAL".
  const dedKriteria = planning.kriteriaDokumen.find((k) =>
    k.jenis.toUpperCase().includes("DED"),
  );
  const lingkunganKriteria = planning.kriteriaDokumen.find((k) =>
    k.jenis.toLowerCase().includes("lingkungan"),
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent layer="1" className="!p-0" {...sheetPushedProps(pushed)}>
        <SheetHeader className="gap-2 pb-4">
          <SheetBreadcrumb
            items={[
              { label: "Daftar Planning", onClick: onClose },
              { label: planning.projectName },
            ]}
          />
          <div className="flex items-center justify-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <FileDown size={13} className="mr-1.5" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => exportPlanningDetailToExcel(planning)}
                >
                  <FileSpreadsheet size={14} className="mr-2" /> Export ke Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportPlanningDetailToPDF(planning)}
                >
                  <FileDown size={14} className="mr-2" /> Export ke PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(planning)}
              >
                <Edit size={13} className="mr-1.5" /> Edit
              </Button>
            )}
            {canSubmit && (
              <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <Loader2 size={13} className="mr-1.5 animate-spin" />
                ) : (
                  <Send size={13} className="mr-1.5" />
                )}
                Ajukan
              </Button>
            )}
          </div>

          <h2 className="text-lg font-semibold leading-snug">
            {planning.projectName}
          </h2>

          {/* Meta line: balai · kode · status (dot inline) — sesuai
              mockup, bukan badge kotak terpisah seperti sebelumnya. */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 size={12} />{" "}
              {planning.balai.shortName ?? planning.balai.name}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {getPlanningKode(planning)}
            </span>
            <Badge variant="dot" dotColor={cfg.dotColor} className="text-xs">
              {cfg.label}
            </Badge>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar size={12} /> {planning.periode.label}
            </span>
          </div>
        </SheetHeader>

        <SheetBody className="px-6 py-6 space-y-6">
          {/* Banner status */}
          {planning.status === "REVISION" && planning.catatan && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle
                size={16}
                className="text-amber-600 shrink-0 mt-0.5"
              />
              <div>
                <p className="text-xs font-semibold text-amber-800 mb-0.5">
                  Perlu Revisi
                </p>
                <p className="text-xs text-amber-700">{planning.catatan}</p>
              </div>
            </div>
          )}
          {planning.status === "REJECTED" && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-red-50 border border-red-200">
              <XCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-800 mb-0.5">
                  Planning Ditolak
                </p>
                <p className="text-xs text-red-700">
                  {planning.catatan || "Tidak ada catatan"}
                </p>
              </div>
            </div>
          )}
          {planning.status === "APPROVED" && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle
                size={16}
                className="text-green-600 shrink-0 mt-0.5"
              />
              <p className="text-xs font-semibold text-green-800">
                Planning Disetujui
              </p>
            </div>
          )}

          {/* Info Proyek — kartu ringkas 6-item, persis mockup (bukan lagi
              2 kartu terpisah dengan daftar field panjang). Field selain
              6 ini (Kewenangan, RTRW, Pola SDA, Kepmen PUPR, breakdown
              Prioritas per tahun, daftar lengkap semua Kriteria Dokumen)
              sengaja dibuang sesuai keputusan menyamakan persis ke mockup. */}
          <div className="space-y-2">
            <SectionHeader title="Info Proyek" icon={FileText} />
            <div className="rounded-lg border p-4 grid grid-cols-2 gap-x-4 gap-y-4">
              <InfoStat
                label="Program / Kegiatan"
                value={
                  firstRo
                    ? `${firstRo.kro.kegiatan.program.code} ${firstRo.kro.kegiatan.program.name} · ${firstRo.kro.kegiatan.code}`
                    : "—"
                }
              />
              <InfoStat
                label="KRO / RO"
                value={firstRo ? `${firstRo.kro.name} · ${firstRo.name}` : "—"}
              />
              <InfoStat
                label="Prioritas Nasional"
                value={
                  isPrioritasNasional
                    ? majorProjectName
                      ? `Ya — ${majorProjectName}`
                      : "Ya"
                    : "Tidak"
                }
              />
              <InfoStat
                label="Diajukan oleh"
                value={`${planning.createdBy.name} (${planning.createdBy.role.name})`}
              />
              <InfoStat
                label="Kriteria Dokumen"
                value={
                  dedKriteria
                    ? `DED — ${dokumenStatusConfig[dedKriteria.status].label}`
                    : "—"
                }
                valueClassName={
                  dedKriteria
                    ? dokumenStatusConfig[dedKriteria.status].dotColor ===
                      "emerald"
                      ? "text-emerald-600"
                      : dokumenStatusConfig[dedKriteria.status].dotColor ===
                          "rose"
                        ? "text-rose-600"
                        : undefined
                    : undefined
                }
              />
              <InfoStat
                label="Dokumen Lingkungan"
                value={
                  lingkunganKriteria
                    ? dokumenStatusConfig[lingkunganKriteria.status].label
                    : "—"
                }
                valueClassName={
                  lingkunganKriteria
                    ? dokumenStatusConfig[lingkunganKriteria.status]
                        .dotColor === "emerald"
                      ? "text-emerald-600"
                      : dokumenStatusConfig[lingkunganKriteria.status]
                            .dotColor === "rose"
                        ? "text-rose-600"
                        : undefined
                    : undefined
                }
              />
            </div>
          </div>

          {/* Alokasi — satu list vertikal per tahun, baris bisa expand inline */}
          {(Object.keys(alokasiByTahun).length > 0 || canManageAlokasi) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionHeader title="Alokasi per Tahun" icon={Calendar} />
                {canManageAlokasi && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 ml-3"
                    onClick={() => {
                      setEditAlokasi(null);
                      setShowAlokasiForm(true);
                    }}
                  >
                    <Plus size={13} className="mr-1.5" /> Alokasi
                  </Button>
                )}
              </div>

              {Object.keys(alokasiByTahun).length === 0 ? (
                <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground text-sm">
                  Belum ada alokasi anggaran untuk planning ini
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(alokasiByTahun)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([tahun, alokasi]) => {
                      const yearRencana = alokasi
                        .filter((a) => a.status === "RENCANA")
                        .reduce((s, a) => s + Number(a.total), 0);
                      const yearRealisasi = alokasi
                        .filter((a) => a.status === "REALISASI")
                        .reduce((s, a) => s + Number(a.total), 0);
                      return (
                        <div
                          key={tahun}
                          className="rounded-lg border overflow-hidden"
                        >
                          {/* Year strip — ringkasan Rencana/Realisasi per
                              tahun, sesuai `.year-strip` di mockup */}
                          <div className="flex items-center gap-3 px-3.5 py-2.5 bg-muted/40 border-b">
                            <span className="text-xs font-bold w-14 shrink-0">
                              {tahun}
                            </span>
                            <div className="flex items-center gap-4 text-xs flex-1 flex-wrap">
                              <span className="text-muted-foreground">
                                Rencana{" "}
                                <b className="text-foreground font-semibold">
                                  {formatRupiahShort(yearRencana)}
                                </b>
                              </span>
                              <span className="text-muted-foreground">
                                Realisasi{" "}
                                <b
                                  className={
                                    yearRealisasi > 0
                                      ? "text-emerald-600 font-semibold"
                                      : "text-foreground font-semibold"
                                  }
                                >
                                  {yearRealisasi > 0
                                    ? formatRupiahShort(yearRealisasi)
                                    : "-"}
                                </b>
                                {yearRealisasi > 0 && (
                                  <span className="text-emerald-600"> ✓</span>
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="divide-y divide-border">
                            {alokasi
                              .filter(
                                (a) =>
                                  canManageAlokasi ||
                                  !(
                                    a.status === "REALISASI" &&
                                    Number(a.total) === 0 &&
                                    a.lokasi.length === 0
                                  ),
                              )
                              .map((a) => {
                                const isExpanded = expandedAlokasi.has(a.id);
                                const ac = alokasiStatusConfig[a.status];
                                return (
                                  <div key={a.id}>
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => toggleAlokasi(a.id)}
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === "Enter" ||
                                          e.key === " "
                                        ) {
                                          e.preventDefault();
                                          toggleAlokasi(a.id);
                                        }
                                      }}
                                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/30 transition-colors outline-none focus-visible:bg-accent/40"
                                    >
                                      <ChevronDown
                                        size={14}
                                        className={`shrink-0 text-muted-foreground transition-transform ${isExpanded ? "" : "-rotate-90"}`}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[10.5px] font-mono text-muted-foreground truncate">
                                          {a.ro.code}
                                        </p>
                                        <p className="text-xs font-semibold truncate">
                                          {a.ro.name} — {ac.label}
                                        </p>
                                      </div>
                                      <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
                                        {a.lokasi.length} lokasi
                                      </span>
                                      <span className="text-xs font-bold shrink-0 w-28 text-right">
                                        {formatRupiahShort(Number(a.total))}
                                      </span>
                                      {canManageAlokasi && (
                                        <div
                                          className="flex items-center gap-0.5 shrink-0"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <TooltipProvider delayDuration={300}>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                  onClick={() =>
                                                    setDeleteAlokasiId(a.id)
                                                  }
                                                >
                                                  <Trash2 size={11} />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                Hapus Alokasi
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                      )}
                                    </div>

                                    {isExpanded && (
                                      <AlokasiExpandPanel
                                        alokasiId={a.id}
                                        onRefreshParent={onRefresh}
                                        projectName={planning.projectName}
                                        onNavigateToList={onClose}
                                        onSubDrawerOpenChange={(isOpen) =>
                                          handleSubDrawerOpenChange(
                                            a.id,
                                            isOpen,
                                          )
                                        }
                                        onEdit={() => {
                                          setEditAlokasi(a);
                                          setShowAlokasiForm(true);
                                        }}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Histori Review */}
          {planning.reviews.length > 0 && (
            <div className="space-y-3">
              <SectionHeader title="Histori Review" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {planning.reviews.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20"
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        r.action === "approve"
                          ? "bg-green-100"
                          : r.action === "reject"
                            ? "bg-red-100"
                            : "bg-amber-100"
                      }`}
                    >
                      {r.action === "approve" ? (
                        <CheckCircle size={14} className="text-green-600" />
                      ) : r.action === "reject" ? (
                        <XCircle size={14} className="text-red-600" />
                      ) : (
                        <RotateCcw size={14} className="text-amber-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium">{r.reviewer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString("id-ID", {
                            dateStyle: "medium",
                          })}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {r.action}
                      </p>
                      {r.catatan && (
                        <p className="text-xs mt-1 text-foreground bg-background rounded px-2 py-1 border">
                          {r.catatan}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Review */}
          {canReview && (
            <div className="space-y-3">
              <SectionHeader title="Berikan Review" />
              <div className="rounded-lg border p-5 space-y-4 bg-muted/20">
                <div className="space-y-2">
                  <Label className="text-xs">
                    Keputusan <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        value: "approve",
                        label: "✅ Setujui",
                        className:
                          "border-green-200 hover:bg-green-50 data-[active=true]:bg-green-100 data-[active=true]:border-green-400 data-[active=true]:text-green-700",
                      },
                      {
                        value: "revision",
                        label: "🔄 Revisi",
                        className:
                          "border-amber-200 hover:bg-amber-50 data-[active=true]:bg-amber-100 data-[active=true]:border-amber-400 data-[active=true]:text-amber-700",
                      },
                      {
                        value: "reject",
                        label: "❌ Tolak",
                        className:
                          "border-red-200 hover:bg-red-50 data-[active=true]:bg-red-100 data-[active=true]:border-red-400 data-[active=true]:text-red-700",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        data-active={reviewAction === opt.value}
                        onClick={() => setReviewAction(opt.value)}
                        className={`text-sm font-medium py-2.5 px-3 rounded-lg border transition-colors ${opt.className}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Catatan untuk SATKER</Label>
                  <Input
                    placeholder="Isi catatan jika diperlukan..."
                    value={reviewCatatan}
                    onChange={(e) => setReviewCatatan(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleReview}
                  disabled={!reviewAction || submitting}
                  className="w-full"
                >
                  {submitting && (
                    <Loader2 size={14} className="mr-2 animate-spin" />
                  )}
                  Kirim Review
                </Button>
              </div>
            </div>
          )}
        </SheetBody>
      </SheetContent>

      {/* Form Tambah/Edit Alokasi — Sheet lapis-2 (Fase 3) */}
      <AlokasiFormDialog
        open={showAlokasiForm}
        onClose={() => setShowAlokasiForm(false)}
        onSuccess={() => {
          setShowAlokasiForm(false);
          onRefresh();
        }}
        planningId={planning.id}
        editData={editAlokasi}
        projectName={planning.projectName}
        onNavigateToList={onClose}
      />

      {/* Delete Alokasi Confirm — tetap AlertDialog kecil terpusat, §3 */}
      <AlertDialog
        open={!!deleteAlokasiId}
        onOpenChange={() => setDeleteAlokasiId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Alokasi?</AlertDialogTitle>
            <AlertDialogDescription>
              Alokasi yang dihapus tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAlokasi}
              disabled={deletingAlokasi}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingAlokasi ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
