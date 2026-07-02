"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Search,
  Filter,
  FileText,
  Eye,
  Trash2,
  Send,
  ChevronDown,
  ChevronRight,
  Layers,
  List,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { ImportExcelDialog } from "@/components/import/import-excel-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Planning, PaginatedResponse } from "@/types";
import { PlanningFormDialog } from "@/components/planning/planning-form-dialog";
import { PlanningDetailDialog } from "@/components/planning/planning-detail-dialog";

const statusConfig = {
  DRAFT: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 border border-slate-200",
    icon: "📝",
  },
  SUBMITTED: {
    label: "Menunggu Review",
    className: "bg-blue-100 text-blue-700 border border-blue-200",
    icon: "⏳",
  },
  REVISION: {
    label: "Perlu Revisi",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
    icon: "🔄",
  },
  REJECTED: {
    label: "Ditolak",
    className: "bg-red-100 text-red-700 border border-red-200",
    icon: "❌",
  },
  APPROVED: {
    label: "Disetujui",
    className: "bg-green-100 text-green-700 border border-green-200",
    icon: "✅",
  },
};

const formatRupiah = (val: string | number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    Number(val),
  );

const formatRupiahShort = (val: number) => {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}M`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}jt`;
  if (val === 0) return "-";
  return formatRupiah(val);
};

export default function PlanningsPage() {
  const { user } = useAuthStore();
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Planning | null>(null);
  const [detailData, setDetailData] = useState<Planning | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPlannings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "100",
        ...(search && { search }),
        ...(statusFilter !== "ALL" && { status: statusFilter }),
      });
      const res = await api.get<PaginatedResponse<Planning>>(
        `/plannings?${params}`,
      );
      setPlannings(res.data.data);
      setTotalPages(res.data.meta.totalPages);
      setTotal(res.data.meta.total);
    } catch {
      toast.error("Gagal memuat data planning");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlannings();
  }, [page, statusFilter]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchPlannings();
    }, 400);
    return () => clearTimeout(timeout);
  }, [search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/plannings/${deleteId}`);
      toast.success("Planning berhasil dihapus");
      setDeleteId(null);
      fetchPlannings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus planning");
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await api.patch(`/plannings/${id}/submit`);
      toast.success("Planning berhasil diajukan");
      fetchPlannings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengajukan planning");
    }
  };

  const canSubmit = (p: Planning) =>
    user?.role === "SATKER" &&
    (p.status === "DRAFT" || p.status === "REVISION");

  const canDelete = (p: Planning) =>
    p.status === "DRAFT" &&
    (user?.role === "ADMINISTRATOR" || p.createdBy.id === user?.id);

  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        kegiatanCode: string;
        kegiatanName: string;
        programCode: string;
        plannings: Planning[];
        totalByYear: Record<number, number>;
        grandTotal: number;
      }
    >();

    const years = new Set<number>();

    for (const p of plannings) {
      const firstAlokasi = p.alokasi[0];
      const kegiatanCode = firstAlokasi?.ro?.kro?.kegiatan?.code || "LAINNYA";
      const kegiatanName =
        firstAlokasi?.ro?.kro?.kegiatan?.name || "Belum ada alokasi";
      const programCode = firstAlokasi?.ro?.kro?.kegiatan?.program?.code || "-";

      if (!map.has(kegiatanCode)) {
        map.set(kegiatanCode, {
          kegiatanCode,
          kegiatanName,
          programCode,
          plannings: [],
          totalByYear: {},
          grandTotal: 0,
        });
      }

      const group = map.get(kegiatanCode)!;
      group.plannings.push(p);

      for (const a of p.alokasi.filter((a) => a.status === "RENCANA")) {
        years.add(a.tahun);
        group.totalByYear[a.tahun] =
          (group.totalByYear[a.tahun] || 0) + Number(a.total);
        group.grandTotal += Number(a.total);
      }
    }

    const sortedYears = [...years].sort((a, b) => a - b);
    return {
      groups: [...map.values()].sort((a, b) =>
        a.kegiatanCode.localeCompare(b.kegiatanCode),
      ),
      years: sortedYears,
    };
  }, [plannings]);

  const toggleGroup = (code: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const renderActions = (p: Planning) => (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDetailData(p)}
            >
              <Eye size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Lihat Detail</TooltipContent>
        </Tooltip>
        {canSubmit(p) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => handleSubmit(p.id)}
              >
                <Send size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ajukan ke Verifikator</TooltipContent>
          </Tooltip>
        )}
        {canDelete(p) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteId(p.id)}
              >
                <Trash2 size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hapus Planning</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} planning ditemukan
          </p>
        </div>
        {(user?.role === "SATKER" || user?.role === "ADMINISTRATOR") && (
          <div className="flex items-center gap-2">
            {(user?.role === "SATKER" || user?.role === "ADMINISTRATOR") && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    console.log("Tombol diklik");
                    setShowImport(true);
                  }}
                >
                  <Upload size={16} className="mr-2" /> Import Excel
                </Button>
                <Button
                  onClick={() => {
                    setEditData(null);
                    setShowForm(true);
                  }}
                >
                  <Plus size={16} className="mr-2" /> Buat Planning
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Cari nama proyek..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <Filter size={14} className="mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SUBMITTED">Menunggu Review</SelectItem>
              <SelectItem value="REVISION">Perlu Revisi</SelectItem>
              <SelectItem value="APPROVED">Disetujui</SelectItem>
              <SelectItem value="REJECTED">Ditolak</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-1 p-1 bg-muted/60 rounded-lg shrink-0">
          <button
            onClick={() => setViewMode("grouped")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "grouped"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Layers size={13} /> Kelompok
          </button>
          <button
            onClick={() => setViewMode("flat")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "flat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List size={13} /> Daftar
          </button>
        </div>
      </div>

      {viewMode === "grouped" && (
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-muted rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : groups.groups.length === 0 ? (
            <Card>
              <CardContent className="text-center py-16 text-muted-foreground">
                <FileText size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Tidak ada planning</p>
              </CardContent>
            </Card>
          ) : (
            groups.groups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.kegiatanCode);
              return (
                <Card key={group.kegiatanCode} className="overflow-hidden">
                  <button
                    onClick={() => toggleGroup(group.kegiatanCode)}
                    className="w-full flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-primary/5 to-transparent hover:from-primary/10 transition-colors text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight
                        size={16}
                        className="text-muted-foreground shrink-0"
                      />
                    ) : (
                      <ChevronDown
                        size={16}
                        className="text-muted-foreground shrink-0"
                      />
                    )}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded font-semibold">
                        {group.programCode}.{group.kegiatanCode}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {group.kegiatanName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {group.plannings.length} proyek
                      </p>
                    </div>

                    <div className="hidden md:flex items-center gap-4 shrink-0 overflow-x-auto max-w-md">
                      {groups.years.slice(-4).map((year) => (
                        <div key={year} className="text-right shrink-0">
                          <p className="text-[10px] text-muted-foreground">
                            {year}
                          </p>
                          <p className="text-xs font-semibold">
                            {formatRupiahShort(group.totalByYear[year] || 0)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="text-right shrink-0 pl-4 border-l">
                      <p className="text-[10px] text-muted-foreground">
                        Total Rencana
                      </p>
                      <p className="text-sm font-bold">
                        {formatRupiahShort(group.grandTotal)}
                      </p>
                    </div>
                  </button>

                  {!isCollapsed && (
                    <CardContent className="p-0 divide-y divide-border border-t">
                      {group.plannings.map((p) => {
                        const cfg = statusConfig[p.status];
                        const alokasiByYear: Record<number, number> = {};
                        for (const a of p.alokasi.filter(
                          (a) => a.status === "RENCANA",
                        )) {
                          alokasiByYear[a.tahun] =
                            (alokasiByYear[a.tahun] || 0) + Number(a.total);
                        }

                        return (
                          <div
                            key={p.id}
                            className="px-5 py-3.5 hover:bg-accent/30 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.className}`}
                                  >
                                    {cfg.icon} {cfg.label}
                                  </span>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {p.balai.shortName}
                                  </span>
                                </div>
                                <p
                                  className="text-sm font-medium cursor-pointer hover:text-primary transition-colors truncate"
                                  onDoubleClick={() => setDetailData(p)}
                                  title="Klik 2x untuk detail"
                                >
                                  {p.projectName}
                                </p>
                              </div>

                              <div className="hidden lg:flex items-center gap-4 shrink-0">
                                {groups.years.slice(-4).map((year) => (
                                  <div key={year} className="w-20 text-right">
                                    <p className="text-xs font-medium">
                                      {formatRupiahShort(
                                        alokasiByYear[year] || 0,
                                      )}
                                    </p>
                                  </div>
                                ))}
                              </div>

                              {renderActions(p)}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {viewMode === "flat" && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-0 divide-y divide-border">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : plannings.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Tidak ada planning</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {plannings.map((p) => {
                  const cfg = statusConfig[p.status];
                  const totalRencana = p.alokasi
                    .filter((a) => a.status === "RENCANA")
                    .reduce((s, a) => s + Number(a.total), 0);

                  return (
                    <div
                      key={p.id}
                      className="p-4 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.className}`}
                            >
                              {cfg.icon} {cfg.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {p.balai.shortName} · {p.periode.label}
                            </span>
                          </div>
                          <p
                            className="font-medium text-sm cursor-pointer hover:text-primary transition-colors"
                            onDoubleClick={() => setDetailData(p)}
                            title="Klik 2x untuk lihat detail"
                          >
                            {p.projectName}
                          </p>
                          <div className="flex items-center gap-4 mt-1.5">
                            <span className="text-xs text-muted-foreground">
                              {p.masaPelaksanaan === "SINGLE_YEAR"
                                ? "Single Year"
                                : "Multi Year"}
                            </span>
                            {totalRencana > 0 && (
                              <span className="text-xs font-medium text-foreground">
                                {formatRupiah(totalRencana)}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              oleh {p.createdBy.name}
                            </span>
                          </div>
                        </div>
                        {renderActions(p)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <PlanningFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          setShowForm(false);
          fetchPlannings();
        }}
        editData={editData}
      />

      {detailData && (
        <PlanningDetailDialog
          open={!!detailData}
          planning={detailData}
          onClose={() => setDetailData(null)}
          onEdit={(p) => {
            setDetailData(null);
            setEditData(p);
            setShowForm(true);
          }}
          onRefresh={fetchPlannings}
        />
      )}

      <ImportExcelDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => {
          setShowImport(false);
          fetchPlannings();
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Planning?</AlertDialogTitle>
            <AlertDialogDescription>
              Planning yang dihapus tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
