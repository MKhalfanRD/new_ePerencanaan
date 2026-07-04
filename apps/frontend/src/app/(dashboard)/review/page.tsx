"use client";

import { useEffect, useState } from "react";
import {
  Search,
  ClipboardCheck,
  Clock,
  Filter,
  FileEdit,
  AlertCircle,
  XCircle,
  CheckCircle2,
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

import api from "@/lib/api";
import { Planning, PaginatedResponse } from "@/types";
import { PlanningDetailSheet } from "@/components/planning/planning-detail-sheet";

const statusConfig = {
  DRAFT: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 border border-slate-200",
    icon: FileEdit,
  },
  SUBMITTED: {
    label: "Menunggu Review",
    className: "bg-blue-100 text-blue-700 border border-blue-200",
    icon: Clock,
  },
  REVISION: {
    label: "Perlu Revisi",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
    icon: AlertCircle,
  },
  REJECTED: {
    label: "Ditolak",
    className: "bg-red-100 text-red-700 border border-red-200",
    icon: XCircle,
  },
  APPROVED: {
    label: "Disetujui",
    className: "bg-green-100 text-green-700 border border-green-200",
    icon: CheckCircle2,
  },
};

const formatRupiah = (val: string | number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(val));

export default function ReviewPage() {
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("SUBMITTED");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [detailData, setDetailData] = useState<Planning | null>(null);

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
      toast.error("Gagal memuat data");
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

  const pendingCount = plannings.filter((p) => p.status === "SUBMITTED").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Planning</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} planning ditemukan
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Clock size={15} className="text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              {pendingCount} menunggu review
            </span>
          </div>
        )}
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
          <SelectTrigger className="w-44">
            <Filter size={14} className="mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="SUBMITTED">Menunggu Review</SelectItem>
            <SelectItem value="APPROVED">Disetujui</SelectItem>
            <SelectItem value="REVISION">Revisi</SelectItem>
            <SelectItem value="REJECTED">Ditolak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : plannings.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardCheck size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">
                Tidak ada planning untuk direview
              </p>
              <p className="text-xs mt-1">Semua planning sudah diproses</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {plannings.map((p) => {
                const cfg = statusConfig[p.status];
                const totalRencana = p.alokasi
                  .filter((a) => a.status === "RENCANA")
                  .reduce((s, a) => s + Number(a.total), 0);
                const lastReview = p.reviews[0];

                return (
                  <div
                    key={p.id}
                    className="p-4 hover:bg-accent/40 transition-colors cursor-pointer"
                    onClick={() => setDetailData(p)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        {/* Status + meta */}
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.className}`}
                          >
                            <cfg.icon size={11} /> {cfg.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {p.balai.shortName} · {p.periode.label}
                          </span>
                        </div>

                        {/* Nama proyek */}
                        <p className="font-medium text-sm">{p.projectName}</p>

                        {/* Info tambahan */}
                        <div className="flex items-center gap-4 mt-1.5">
                          <span className="text-xs text-muted-foreground">
                            Diajukan oleh{" "}
                            <span className="font-medium text-foreground">
                              {p.createdBy.name}
                            </span>
                          </span>
                          {totalRencana > 0 && (
                            <span className="text-xs font-medium">
                              {formatRupiah(totalRencana)}
                            </span>
                          )}
                        </div>

                        {/* Catatan terakhir */}
                        {p.catatan && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1 mt-2 inline-block">
                            💬 {p.catatan}
                          </p>
                        )}

                        {/* Histori review terakhir */}
                        {lastReview && (
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Review terakhir oleh{" "}
                            <span className="font-medium">
                              {lastReview.reviewer.name}
                            </span>{" "}
                            — {lastReview.action} ·{" "}
                            {new Date(lastReview.createdAt).toLocaleDateString(
                              "id-ID",
                              { dateStyle: "medium" },
                            )}
                          </p>
                        )}
                      </div>

                      {/* Arrow indicator */}
                      <div className="shrink-0 text-muted-foreground text-xs mt-1">
                        Klik untuk review →
                      </div>
                    </div>
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

      {/* Detail Sheet */}
      {detailData && (
        <PlanningDetailSheet
          open={!!detailData}
          planning={detailData}
          onClose={() => setDetailData(null)}
          onEdit={() => {}}
          onRefresh={() => {
            setDetailData(null);
            fetchPlannings();
          }}
        />
      )}
    </div>
  );
}
