"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { ActivityLogRow, MODUL, namaModul, ceritakanAktivitas } from "@/lib/activity-log";
import { ActivityDetailDialog } from "@/components/activity-log/activity-detail-dialog";

/**
 * Log aktivitas seluruh user. Sengaja hanya untuk SUPER_ADMIN — backend
 * juga menolak role lain, jadi penjagaan di sini murni supaya UI-nya tidak
 * menampilkan halaman kosong dengan error 403.
 */
export default function ActivityLogPage() {
  const { user } = useAuthStore();
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [modul, setModul] = useState("SEMUA");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailRow, setDetailRow] = useState<ActivityLogRow | null>(null);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get("/activity-log", {
        params: {
          page,
          limit: 50,
          search: debounced,
          entity: modul !== "SEMUA" ? modul : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      })
      .then((res) => {
        setRows(res.data.data);
        setTotalPages(res.data.meta.totalPages);
        setTotal(res.data.meta.total);
      })
      .catch(() => toast.error("Gagal memuat log aktivitas"))
      .finally(() => setLoading(false));
  }, [page, debounced, modul, dateFrom, dateTo, isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-20 text-center">
        <ShieldAlert className="text-muted-foreground" size={28} />
        <p className="text-sm font-semibold">Akses ditolak</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Log aktivitas hanya dapat dilihat oleh Super Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Log Aktivitas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Siapa melakukan apa, kapan, dan di bagian mana. Klik baris untuk lihat
          detail perubahan.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-xs flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="h-9 pl-9 text-sm"
            placeholder="Cari nama pengguna..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={modul}
          onValueChange={(v) => {
            setModul(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-44 text-sm">
            <SelectValue placeholder="Semua modul" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SEMUA">Semua modul</SelectItem>
            {Object.entries(MODUL).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Dari tanggal</label>
            <Input
              type="date"
              className="h-9 w-36 text-sm"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Sampai tanggal</label>
            <Input
              type="date"
              className="h-9 w-36 text-sm"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-muted-foreground" size={22} />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed py-16 text-center text-sm text-muted-foreground">
          Belum ada aktivitas tercatat
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-4 py-2.5 font-semibold text-foreground">Waktu</th>
                <th className="px-4 py-2.5 font-semibold text-foreground">Pengguna</th>
                <th className="px-4 py-2.5 font-semibold text-foreground">Modul</th>
                <th className="px-4 py-2.5 font-semibold text-foreground">Aktivitas</th>
                <th className="px-4 py-2.5 font-semibold text-foreground">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => {
                const canOpen = (r.meta?.changes ?? []).length > 0;
                return (
                  <tr
                    key={r.id}
                    onClick={() => canOpen && setDetailRow(r)}
                    className={`${i % 2 === 1 ? "bg-muted/30" : ""} hover:bg-accent/40 ${
                      canOpen ? "cursor-pointer" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-foreground">
                      {new Date(r.createdAt).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-foreground">
                        {r.user?.name ?? r.username}
                      </span>
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {r.roleCode ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary" className="text-xs font-normal">
                        {namaModul(r.entity)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">
                      {ceritakanAktivitas(r)}
                      {canOpen && (
                        <span className="ml-1.5 text-xs text-primary underline">
                          lihat detail
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {r.ip ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Halaman {page} dari {totalPages} · {total} aktivitas
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      <ActivityDetailDialog row={detailRow} onClose={() => setDetailRow(null)} />
    </div>
  );
}
