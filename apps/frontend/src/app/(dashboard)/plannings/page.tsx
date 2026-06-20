"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  FileText,
  Eye,
  Trash2,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Planning, PaginatedResponse } from "@/types";
import { PlanningFormDialog } from "@/components/planning/planning-form-dialog";
import { PlanningDetailDialog } from "@/components/planning/planning-detail-dialog";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { FileSpreadsheet, FileDown } from "lucide-react";
import {
  exportPlanningsToExcel,
  exportPlanningsToPDF,
} from "@/lib/export-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Upload } from "lucide-react";
import { ImportExcelDialog } from "@/components/import/import-excel-dialog";

const statusConfig = {
  DRAFT: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 border border-slate-200",
  },
  SUBMITTED: {
    label: "Menunggu Review",
    className: "bg-blue-100 text-blue-700 border border-blue-200",
  },
  REVISION: {
    label: "Perlu Revisi",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
  },
  REJECTED: {
    label: "Ditolak",
    className: "bg-red-100 text-red-700 border border-red-200",
  },
  APPROVED: {
    label: "Disetujui",
    className: "bg-green-100 text-green-700 border border-green-200",
  },
};

const formatRupiah = (val: string | number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(val));

export default function PlanningsPage() {
  const { user } = useAuthStore();
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Planning | null>(null);
  const [detailData, setDetailData] = useState<Planning | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showImport, setShowImport] = useState(false);

  const fetchPlannings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
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

  const canEdit = (p: Planning) =>
    (user?.role === "SATKER" || user?.role === "ADMINISTRATOR") &&
    (p.status === "DRAFT" || p.status === "REVISION");

  const canSubmit = (p: Planning) =>
    user?.role === "SATKER" &&
    (p.status === "DRAFT" || p.status === "REVISION") &&
    p.createdBy.id === user?.id;

  const canDelete = (p: Planning) =>
    p.status === "DRAFT" &&
    (user?.role === "ADMINISTRATOR" || p.createdBy.id === user?.id);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} planning ditemukan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <FileDown size={16} className="mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  exportPlanningsToExcel(plannings, "daftar-planning")
                }
              >
                <FileSpreadsheet size={14} className="mr-2" /> Export ke Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  exportPlanningsToPDF(plannings, "daftar-planning")
                }
              >
                <FileDown size={14} className="mr-2" /> Export ke PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {(user?.role === "SATKER" || user?.role === "ADMINISTRATOR") && (
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload size={16} className="mr-2" />
              Import Excel
            </Button>
          )}

          {(user?.role === "SATKER" || user?.role === "ADMINISTRATOR") && (
            <Button
              onClick={() => {
                setEditData(null);
                setShowForm(true);
              }}
            >
              <Plus size={16} className="mr-2" />
              Buat Planning
            </Button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
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
          <SelectTrigger className="w-40">
            <Filter size={14} className="mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Diajukan</SelectItem>
            <SelectItem value="REVISION">Revisi</SelectItem>
            <SelectItem value="APPROVED">Disetujui</SelectItem>
            <SelectItem value="REJECTED">Ditolak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
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
              <p className="text-xs mt-1">
                Coba ubah filter atau buat planning baru
              </p>
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
                    className="p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
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
                          onClick={() => setDetailData(p)}
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

                      {/* Actions */}
                      <TooltipProvider delayDuration={300}>
                        <div className="flex items-center gap-1 shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setDetailData(p)}
                              >
                                <Eye size={15} />
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
                                  className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleSubmit(p.id)}
                                >
                                  <Send size={15} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Ajukan ke Verifikator
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {canDelete(p) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteId(p.id)}
                                >
                                  <Trash2 size={15} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Hapus Planning</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TooltipProvider>
                    </div>
                    {p.status === "DRAFT" && user?.role === "SATKER" && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
                        <Send size={12} className="shrink-0" />
                        <span>
                          Planning ini belum diajukan. Klik tombol{" "}
                          <strong>ajukan</strong> untuk mengirim ke verifikator.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
          </Button>
        </div>
      )}

      {/* Form Dialog */}
      <PlanningFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          setShowForm(false);
          fetchPlannings();
        }}
        editData={editData}
      />

      {/* Detail Dialog */}
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

      {/* Delete Confirm */}
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
      <ImportExcelDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => {
          setShowImport(false);
          fetchPlannings();
        }}
      />
    </div>
  );
}
