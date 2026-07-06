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
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
  Minimize2,
  CheckCircle2,
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
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Planning, PaginatedResponse } from "@/types";
import { PlanningFormDialog } from "@/components/planning/planning-form-dialog";
import { PlanningDetailSheet } from "@/components/planning/planning-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { statusConfig } from "@/components/shared/status-config";

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
        rencanaByYear: Record<number, number>;
        realisasiByYear: Record<number, number>;
        grandTotalRencana: number;
        grandTotalRealisasi: number;
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
          rencanaByYear: {},
          realisasiByYear: {},
          grandTotalRencana: 0,
          grandTotalRealisasi: 0,
        });
      }

      const group = map.get(kegiatanCode)!;
      group.plannings.push(p);

      for (const a of p.alokasi) {
        years.add(a.tahun);
        const value = Number(a.total);
        if (a.status === "RENCANA") {
          group.rencanaByYear[a.tahun] =
            (group.rencanaByYear[a.tahun] || 0) + value;
          group.grandTotalRencana += value;
        } else {
          group.realisasiByYear[a.tahun] =
            (group.realisasiByYear[a.tahun] || 0) + value;
          group.grandTotalRealisasi += value;
        }
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

  const allCollapsed =
    groups.groups.length > 0 && collapsedGroups.size === groups.groups.length;

  const toggleGroup = (code: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleAllGroups = () => {
    if (allCollapsed) {
      setCollapsedGroups(new Set());
    } else {
      setCollapsedGroups(new Set(groups.groups.map((g) => g.kegiatanCode)));
    }
  };

  // Kode identitas ringkas per proyek, mis. "WA.7755.EBA" — dari kode Balai +
  // Program.Kegiatan pada alokasi pertamanya. Ditampilkan langsung di baris
  // list supaya user tidak perlu buka detail hanya untuk mengenali proyek.
  const getPlanningKode = (p: Planning) => {
    const a = p.alokasi[0];
    const balaiCode = p.balai.code || p.balai.shortName || "-";
    const programCode = a?.ro?.kro?.kegiatan?.program?.code || "-";
    const kegiatanCode = a?.ro?.kro?.kegiatan?.code || "-";
    return `${balaiCode}.${programCode}.${kegiatanCode}`;
  };

  const realisasiPct = (rencana: number, realisasi: number) => {
    if (rencana > 0) return Math.round((realisasi / rencana) * 100);
    return realisasi > 0 ? 100 : 0;
  };

  // Sel angka per tahun: baris atas = Rencana, baris bawah = Realisasi
  // (dengan centang bila sudah terisi). Dipakai di baris tiap proyek.
  const renderYearCell = (
    v: { rencana: number; realisasi: number } | undefined,
  ) => {
    const rencana = v?.rencana || 0;
    const realisasi = v?.realisasi || 0;
    return (
      <div className="w-24 shrink-0 text-right">
        <p className="text-xs font-semibold">{formatRupiahShort(rencana)}</p>
        <p className="text-[11px] text-emerald-600 flex items-center justify-end gap-1">
          {realisasi > 0 && (
            <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
          )}
          {formatRupiahShort(realisasi)}
        </p>
      </div>
    );
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

        <Button
          variant="outline"
          size="sm"
          onClick={toggleAllGroups}
          className="shrink-0 text-xs"
        >
          {allCollapsed ? (
            <Maximize2 size={13} className="mr-1.5" />
          ) : (
            <Minimize2 size={13} className="mr-1.5" />
          )}
          {allCollapsed ? "Buka Semua" : "Tutup Semua"}
        </Button>
      </div>

      {/* Sub-header kolom tahun — sekali saja untuk seluruh daftar */}
      {!loading && groups.groups.length > 0 && (
        <div className="hidden md:flex items-center gap-4 px-5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-4">
            {groups.years.map((year) => (
              <div key={year} className="w-24 shrink-0 text-right">
                {year}
              </div>
            ))}
            <div className="w-24 shrink-0 text-right border-l pl-3">Total</div>
          </div>
          <div className="w-[76px] shrink-0" />
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
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
            const pct = realisasiPct(
              group.grandTotalRencana,
              group.grandTotalRealisasi,
            );
            const barColor =
              pct >= 80
                ? "bg-emerald-400"
                : pct >= 40
                  ? "bg-amber-400"
                  : "bg-rose-400";

            return (
              <Card
                key={group.kegiatanCode}
                className="overflow-hidden border-l-4 border-l-blue-600 py-0"
              >
                <button
                  onClick={() => toggleGroup(group.kegiatanCode)}
                  className="w-full text-left bg-card text-foreground transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-center gap-3 px-5 pt-3.5 pb-2">
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
                    <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded font-semibold shrink-0">
                      {group.programCode}.{group.kegiatanCode}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {group.kegiatanName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {group.plannings.length} proyek
                      </p>
                    </div>

                    {/* Total per tahun & keseluruhan — atas Rencana, bawah Realisasi */}
                    <div className="hidden md:flex items-center gap-4 shrink-0">
                      {groups.years.map((year) => (
                        <div key={year} className="w-24 shrink-0 text-right">
                          <p className="text-xs font-semibold tabular-nums">
                            {formatRupiahShort(group.rencanaByYear[year] || 0)}
                          </p>
                          <p className="text-[11px] text-emerald-600 tabular-nums">
                            {formatRupiahShort(
                              group.realisasiByYear[year] || 0,
                            )}
                          </p>
                        </div>
                      ))}
                      <div className="w-24 shrink-0 text-right border-l pl-3">
                        <p className="text-sm font-bold tabular-nums">
                          {formatRupiahShort(group.grandTotalRencana)}
                        </p>
                        <p className="text-[11px] text-emerald-600 tabular-nums">
                          {formatRupiahShort(group.grandTotalRealisasi)}
                        </p>
                      </div>
                    </div>
                    <div className="w-[76px] shrink-0" />
                  </div>
                  <div className="px-5 pb-3 flex items-center gap-2">
                    <div className="h-[5px] w-full max-w-[200px] rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                      {pct}%
                    </span>
                  </div>
                </button>

                {!isCollapsed && (
                  <CardContent className="p-0 divide-y divide-border border-t">
                    {group.plannings.map((p) => {
                      const cfg = statusConfig[p.status];
                      const byYear: Record<
                        number,
                        { rencana: number; realisasi: number }
                      > = {};
                      for (const a of p.alokasi) {
                        if (!byYear[a.tahun]) {
                          byYear[a.tahun] = { rencana: 0, realisasi: 0 };
                        }
                        if (a.status === "RENCANA") {
                          byYear[a.tahun].rencana += Number(a.total);
                        } else {
                          byYear[a.tahun].realisasi += Number(a.total);
                        }
                      }
                      const total = Object.values(byYear).reduce(
                        (acc, v) => {
                          acc.rencana += v.rencana;
                          acc.realisasi += v.realisasi;
                          return acc;
                        },
                        { rencana: 0, realisasi: 0 },
                      );

                      return (
                        <div
                          key={p.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setDetailData(p)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setDetailData(p);
                            }
                          }}
                          className="group px-5 py-3 hover:bg-accent/30 transition-colors cursor-pointer outline-none focus-visible:bg-accent/40"
                        >
                          <div className="flex items-center gap-4">
                            <Badge
                              variant="dot"
                              dotColor={cfg.dotColor}
                              className="shrink-0"
                            >
                              {cfg.label}
                            </Badge>

                            <div className="min-w-0 flex-1">
                              <span className="inline-block text-[11px] font-mono font-medium text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded shrink-0 truncate mb-1">
                                {getPlanningKode(p)}
                              </span>
                              <p className="text-sm font-medium truncate mb-0.5 group-hover:text-primary transition-colors">
                                {p.projectName}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {p.balai.shortName}
                              </p>
                            </div>

                            <div className="hidden md:flex items-center gap-4 shrink-0">
                              {groups.years.map((year) =>
                                renderYearCell(byYear[year]),
                              )}
                              <div className="w-24 shrink-0 text-right border-l pl-3">
                                <p className="text-xs font-bold">
                                  {formatRupiahShort(total.rencana)}
                                </p>
                                <p className="text-[11px] font-semibold text-emerald-600">
                                  {formatRupiahShort(total.realisasi)}
                                </p>
                              </div>
                            </div>

                            {/* Afordansi visual pengganti tooltip "klik 2x": chevron
                                muncul saat baris di-hover, menandakan seluruh baris
                                bisa diklik untuk membuka detail. */}
                            <ChevronRight
                              size={16}
                              className="hidden md:block shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            />

                            <div onClick={(e) => e.stopPropagation()}>
                              {renderActions(p)}
                            </div>
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

      {!loading && groups.groups.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Halaman {page} dari {totalPages} &middot; {total} planning total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(1)}
              disabled={page <= 1}
              title="Halaman pertama"
            >
              <ChevronsLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={14} className="mr-1" /> Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Berikutnya <ChevronRight size={14} className="ml-1" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              title="Halaman terakhir"
            >
              <ChevronsRight size={14} />
            </Button>
          </div>
        </div>
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
        <PlanningDetailSheet
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
