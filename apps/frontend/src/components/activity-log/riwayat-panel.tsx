"use client";

import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";

import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { ActivityLogRow, ceritakanAktivitas } from "@/lib/activity-log";
import { ActivityDetailDialog } from "./activity-detail-dialog";

interface Props {
  entity: string;
  entityId: string;
}

/**
 * Widget "Riwayat Perubahan" untuk ditanam di halaman detail sebuah record
 * (mis. detail Proyek). Sengaja cuma tampil untuk SUPER_ADMIN — sama
 * seperti halaman Log Aktivitas terpusat, backend juga menolak role lain.
 */
export function RiwayatPerubahan({ entity, entityId }: Props) {
  const { user } = useAuthStore();
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailRow, setDetailRow] = useState<ActivityLogRow | null>(null);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoading(true);
    // Untuk Proyek, ikutkan juga mutasi Paket/Alokasi di bawahnya (lihat
    // relatedProyekId di activity-log.service.ts) — kalau tidak, riwayat
    // edit alokasi/paket proyek ini tidak pernah muncul di sini.
    const params =
      entity === "proyek"
        ? { relatedProyekId: entityId, limit: 20 }
        : { entity, entityId, limit: 20 };
    api
      .get("/activity-log", { params })
      .then((res) => setRows(res.data.data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [entity, entityId, isSuperAdmin]);

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <History size={14} className="text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Riwayat Perubahan
        </p>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="rounded-lg border divide-y">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="animate-spin text-muted-foreground" size={18} />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Belum ada riwayat perubahan tercatat
          </p>
        ) : (
          rows.map((r) => {
            const canOpen = (r.meta?.changes ?? []).length > 0;
            return (
              <div
                key={r.id}
                role={canOpen ? "button" : undefined}
                tabIndex={canOpen ? 0 : undefined}
                onClick={() => canOpen && setDetailRow(r)}
                className={`px-3 py-2.5 text-xs ${
                  canOpen ? "cursor-pointer hover:bg-accent/30" : ""
                }`}
              >
                <p className="text-foreground">
                  {ceritakanAktivitas(r)}
                  {canOpen && (
                    <span className="ml-1.5 text-primary underline">
                      lihat detail
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {r.user?.name ?? r.username} ·{" "}
                  {new Date(r.createdAt).toLocaleString("id-ID", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            );
          })
        )}
      </div>

      <ActivityDetailDialog row={detailRow} onClose={() => setDetailRow(null)} />
    </div>
  );
}
