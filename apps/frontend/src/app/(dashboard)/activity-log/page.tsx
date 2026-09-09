"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface LogRow {
  id: string;
  username: string;
  roleCode?: string | null;
  method: string;
  path: string;
  entity?: string | null;
  entityId?: string | null;
  statusCode: number;
  ip?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
  user?: { id: string; name: string } | null;
}

const warnaMethod: Record<string, string> = {
  POST: "text-emerald-600 bg-emerald-50",
  PATCH: "text-amber-600 bg-amber-50",
  PUT: "text-amber-600 bg-amber-50",
  DELETE: "text-red-600 bg-red-50",
};

/**
 * Log aktivitas seluruh user. Sengaja hanya untuk SUPER_ADMIN — backend
 * juga menolak role lain, jadi penjagaan di sini murni supaya UI-nya tidak
 * menampilkan halaman kosong dengan error 403.
 */
export default function ActivityLogPage() {
  const { user } = useAuthStore();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

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
      .get("/activity-log", { params: { page, limit: 50, search: debounced } })
      .then((res) => {
        setRows(res.data.data);
        setTotalPages(res.data.meta.totalPages);
        setTotal(res.data.meta.total);
      })
      .catch(() => toast.error("Gagal memuat log aktivitas"))
      .finally(() => setLoading(false));
  }, [page, debounced, isSuperAdmin]);

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
          Rekam jejak seluruh perubahan data per pengguna dan role
        </p>
      </div>

      <div className="relative max-w-md">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="h-9 pl-9 text-sm"
          placeholder="Cari username atau endpoint..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Waktu</th>
                <th className="px-3 py-2 font-semibold">Pengguna</th>
                <th className="px-3 py-2 font-semibold">Role</th>
                <th className="px-3 py-2 font-semibold">Aksi</th>
                <th className="px-3 py-2 font-semibold">Endpoint</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-accent/30">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{r.user?.name ?? r.username}</span>
                    <span className="ml-1 text-muted-foreground">
                      ({r.username})
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px]">
                      {r.roleCode ?? "—"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                        warnaMethod[r.method] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.method}
                    </span>
                  </td>
                  <td className="max-w-[320px] truncate px-3 py-2 font-mono text-[10.5px]">
                    {r.path}
                  </td>
                  <td className="px-3 py-2">{r.statusCode}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.ip ?? "—"}
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
