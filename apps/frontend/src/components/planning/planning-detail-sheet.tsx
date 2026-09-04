"use client";

import { useEffect, useState } from "react";
import {
  Edit,
  CheckCheck,
  RotateCcw,
  Loader2,
  Calendar,
  Building2,
  FileText,
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  Plus,
  Trash2,
  Package,
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
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Planning, Paket, Alokasi } from "@/types";
import {
  exportPlanningDetailToExcel,
  exportPlanningDetailToPDF,
} from "@/lib/export-utils";
import { AlokasiFormDialog } from "./alokasi-form-dialog";
import { AlokasiExpandPanel } from "./alokasi-expand-panel";
import { PaketFormDialog } from "./paket-form-dialog";
import {
  statusConfig,
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
  const ro = (p.paket ?? [])[0]?.ro;
  const balaiCode = p.balai.code || p.balai.shortName || "-";
  const programCode = ro?.kro?.kegiatan?.program?.code || "-";
  const kegiatanCode = ro?.kro?.kegiatan?.code || "-";
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
  const [approving, setApproving] = useState(false);
  const [showPaketForm, setShowPaketForm] = useState(false);
  const [editPaket, setEditPaket] = useState<Paket | null>(null);
  const [deletePaketId, setDeletePaketId] = useState<string | null>(null);
  const [deletingPaket, setDeletingPaket] = useState(false);

  const [showAlokasiForm, setShowAlokasiForm] = useState(false);
  const [activePaketId, setActivePaketId] = useState<string | null>(null);
  const [editAlokasi, setEditAlokasi] = useState<Alokasi | null>(null);
  const [deleteAlokasiId, setDeleteAlokasiId] = useState<string | null>(null);
  const [deletingAlokasi, setDeletingAlokasi] = useState(false);
  // Baris alokasi yang sedang expand — pengganti `detailAlokasiId` +
  // AlokasiDetailDialog (modal ke-2) lama. Bisa lebih dari satu terbuka.
  const [expandedAlokasi, setExpandedAlokasi] = useState<Set<string>>(
    new Set(),
  );
  // Paket yang sedang expand menampilkan daftar Alokasi per tahunnya.
  const [expandedPaket, setExpandedPaket] = useState<Set<string>>(new Set());

  const togglePaket = (id: string) => {
    setExpandedPaket((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAlokasi = (id: string) => {
    setExpandedAlokasi((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canEdit =
    user?.role === "SATKER" || user?.role === "ADMINISTRATOR";

  const canManagePaket = canEdit;

  const handleApprove = async () => {
    setApproving(true);
    try {
      await api.patch(`/plannings/${planning.id}/approve`);
      toast.success("Proyek disetujui");
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyetujui proyek");
    } finally {
      setApproving(false);
    }
  };

  const handleUnapprove = async () => {
    setApproving(true);
    try {
      await api.patch(`/plannings/${planning.id}/unapprove`);
      toast.success("Proyek dikembalikan ke draft");
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Gagal mengembalikan proyek ke draft",
      );
    } finally {
      setApproving(false);
    }
  };

  const handleDeletePaket = async () => {
    if (!deletePaketId) return;
    setDeletingPaket(true);
    try {
      await api.delete(`/paket/${deletePaketId}`);
      toast.success("Paket berhasil dihapus");
      setDeletePaketId(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus paket");
    } finally {
      setDeletingPaket(false);
    }
  };

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

  const cfg = statusConfig[planning.status];
  // Backend selalu balikin array, tapi dijaga di sini juga — dipakai berulang di bawah.
  const paket = planning.paket ?? [];
  const firstRo = paket[0]?.ro;
  const kegiatanPrioritasPaket = paket.find((pk) => pk.kegiatanPrioritas);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent layer="1" className="!p-0">
        <SheetHeader className="gap-2 pb-4">
          <SheetBreadcrumb
            items={[
              { label: "Daftar Proyek", onClick: onClose },
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
                <Edit size={13} className="mr-1.5" /> Edit Proyek
              </Button>
            )}
            {user?.role === "ADMINISTRATOR" && planning.status === "DRAFT" && (
              <Button size="sm" onClick={handleApprove} disabled={approving}>
                {approving ? (
                  <Loader2 size={13} className="mr-1.5 animate-spin" />
                ) : (
                  <CheckCheck size={13} className="mr-1.5" />
                )}
                Setujui
              </Button>
            )}
            {user?.role === "ADMINISTRATOR" &&
              planning.status === "APPROVED" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUnapprove}
                  disabled={approving}
                >
                  {approving ? (
                    <Loader2 size={13} className="mr-1.5 animate-spin" />
                  ) : (
                    <RotateCcw size={13} className="mr-1.5" />
                  )}
                  Kembalikan ke Draft
                </Button>
              )}
          </div>

          <SheetTitle className="text-lg leading-snug">
            {planning.projectName}
          </SheetTitle>

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
          {/* Info Proyek — kartu ringkas, field detail nomenklatur diambil
              dari paket pertama (Planning sendiri tidak lagi menyimpan
              Program/Kegiatan/KRO/RO — itu melekat di tiap Paket). */}
          <div className="space-y-2">
            <SectionHeader title="Info Proyek" icon={FileText} />
            <div className="rounded-lg border p-4 grid grid-cols-2 gap-x-4 gap-y-4">
              <InfoStat
                label="Kode Proyek"
                value={planning.kodeProyek || "—"}
              />
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
                  kegiatanPrioritasPaket?.kegiatanPrioritas
                    ? `Ya — ${kegiatanPrioritasPaket.kegiatanPrioritas.name}`
                    : "Tidak"
                }
              />
              <InfoStat
                label="Diajukan oleh"
                value={`${planning.createdBy.name} (${planning.createdBy.role.name})`}
              />
              <InfoStat
                label="Sumber Usulan"
                value={
                  planning.sumberUsulanProyek
                    ? [
                        "PEMERINTAH_DAERAH",
                        "KEMENTERIAN_LEMBAGA",
                        "LAINNYA",
                      ].includes(planning.sumberUsulanProyek) &&
                      planning.sumberUsulanLainnya
                      ? `${planning.sumberUsulanProyek.replaceAll("_", " ")} — ${planning.sumberUsulanLainnya}`
                      : planning.sumberUsulanProyek.replaceAll("_", " ")
                    : "—"
                }
              />
              <InfoStat
                label="Jumlah Paket"
                value={String(paket.length)}
              />
            </div>
          </div>

          {/* Daftar Paket — level baru di antara Proyek & Alokasi. */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionHeader title="Paket" icon={Package} />
              {canManagePaket && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 ml-3"
                  onClick={() => {
                    setEditPaket(null);
                    setShowPaketForm(true);
                  }}
                >
                  <Plus size={13} className="mr-1.5" /> Paket
                </Button>
              )}
            </div>

            {paket.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground text-sm">
                Belum ada paket untuk proyek ini
              </div>
            ) : (
              <div className="space-y-3">
                {paket.map((pk) => {
                  const isPaketExpanded = expandedPaket.has(pk.id);
                  const alokasiByTahun = pk.alokasi.reduce<
                    Record<number, typeof pk.alokasi>
                  >((acc, a) => {
                    if (!acc[a.tahun]) acc[a.tahun] = [];
                    acc[a.tahun].push(a);
                    return acc;
                  }, {});
                  const totalPaket = pk.alokasi.reduce(
                    (s, a) => s + Number(a.total),
                    0,
                  );

                  return (
                    <div key={pk.id} className="rounded-lg border overflow-hidden">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => togglePaket(pk.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            togglePaket(pk.id);
                          }
                        }}
                        className="flex items-center gap-3 px-3.5 py-3 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors outline-none focus-visible:bg-accent/40"
                      >
                        <ChevronDown
                          size={14}
                          className={`shrink-0 text-muted-foreground transition-transform ${isPaketExpanded ? "" : "-rotate-90"}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">
                            {pk.name}
                          </p>
                          <p className="text-[10.5px] font-mono text-muted-foreground truncate">
                            {pk.ro.code} · {pk.ro.name}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {pk.jenis === "FISIK" ? "Fisik" : "Non-Fisik"}
                        </Badge>
                        <span className="text-xs font-bold shrink-0 w-28 text-right">
                          {formatRupiahShort(totalPaket)}
                        </span>
                        {canManagePaket && (
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
                                    className="h-6 w-6"
                                    onClick={() => {
                                      setEditPaket(pk);
                                      setShowPaketForm(true);
                                    }}
                                  >
                                    <Edit size={11} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Paket</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setDeletePaketId(pk.id)}
                                  >
                                    <Trash2 size={11} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Hapus Paket</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>

                      {isPaketExpanded && (
                        <div className="p-3.5 space-y-3">
                          {canManagePaket && (
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setActivePaketId(pk.id);
                                  setEditAlokasi(null);
                                  setShowAlokasiForm(true);
                                }}
                              >
                                <Plus size={13} className="mr-1.5" /> Alokasi
                              </Button>
                            </div>
                          )}

                          {Object.keys(alokasiByTahun).length === 0 ? (
                            <div className="rounded-lg border-2 border-dashed p-6 text-center text-muted-foreground text-xs">
                              Belum ada alokasi anggaran untuk paket ini
                            </div>
                          ) : (
                            <div className="space-y-3 rounded-lg border overflow-hidden">
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
                                    <div key={tahun} className="border-b last:border-b-0">
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
                                                ? formatRupiahShort(
                                                    yearRealisasi,
                                                  )
                                                : "-"}
                                            </b>
                                            {yearRealisasi > 0 && (
                                              <span className="text-emerald-600">
                                                {" "}
                                                ✓
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="divide-y divide-border">
                                        {alokasi.map((a) => {
                                          const isExpanded =
                                            expandedAlokasi.has(a.id);
                                          const ac =
                                            alokasiStatusConfig[a.status];
                                          return (
                                            <div key={a.id}>
                                              <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={() =>
                                                  toggleAlokasi(a.id)
                                                }
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
                                                  <p className="text-xs font-semibold truncate">
                                                    {ac.label}
                                                  </p>
                                                </div>
                                                <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
                                                  {a.lokasi.length} lokasi
                                                </span>
                                                <span className="text-xs font-bold shrink-0 w-28 text-right">
                                                  {formatRupiahShort(
                                                    Number(a.total),
                                                  )}
                                                </span>
                                                {canManagePaket && (
                                                  <div
                                                    className="flex items-center gap-0.5 shrink-0"
                                                    onClick={(e) =>
                                                      e.stopPropagation()
                                                    }
                                                  >
                                                    <TooltipProvider
                                                      delayDuration={300}
                                                    >
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() =>
                                                              setDeleteAlokasiId(
                                                                a.id,
                                                              )
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
                                                  projectName={
                                                    planning.projectName
                                                  }
                                                  onNavigateToList={onClose}
                                                  onSubDrawerOpenChange={() => {}}
                                                  onEdit={() => {
                                                    setActivePaketId(pk.id);
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetBody>
      </SheetContent>

      {/* Form Tambah/Edit Paket — Sheet lapis-2 */}
      <PaketFormDialog
        open={showPaketForm}
        onClose={() => setShowPaketForm(false)}
        onSuccess={() => {
          setShowPaketForm(false);
          onRefresh();
        }}
        planningId={planning.id}
        editData={editPaket}
        projectName={planning.projectName}
        onNavigateToList={onClose}
      />

      {/* Form Tambah/Edit Alokasi — Sheet lapis-2 */}
      {activePaketId && (
        <AlokasiFormDialog
          open={showAlokasiForm}
          onClose={() => setShowAlokasiForm(false)}
          onSuccess={() => {
            setShowAlokasiForm(false);
            onRefresh();
          }}
          paketId={activePaketId}
          roSatuan={paket.find((p) => p.id === activePaketId)?.ro?.satuan}
          editData={editAlokasi}
          projectName={planning.projectName}
          onNavigateToList={onClose}
        />
      )}

      {/* Delete Paket Confirm */}
      <AlertDialog
        open={!!deletePaketId}
        onOpenChange={() => setDeletePaketId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Paket?</AlertDialogTitle>
            <AlertDialogDescription>
              Paket beserta seluruh alokasi & lokasinya akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePaket}
              disabled={deletingPaket}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingPaket ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Alokasi Confirm — tetap AlertDialog kecil terpusat */}
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
