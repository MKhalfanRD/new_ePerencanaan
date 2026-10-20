"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

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
        <h3 className="flex-1 text-sm font-semibold">Riwayat proyek</h3>
        <span className="rounded-full bg-tier-1 px-2 py-0.5 text-[11px] text-muted-foreground">hanya admin</span>
      </div>

      <div className="divide-y border-t">
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
                className={`flex gap-2.5 py-2.5 text-[13px] ${
                  canOpen ? "cursor-pointer hover:bg-accent/40" : ""
                }`}
              >
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-st-draft" />
                <div className="min-w-0">
                <p className="font-semibold">
                  {r.user?.name ?? r.username}{" "}
                  <span className="font-normal text-muted-foreground">
                    ·{" "}
                    {new Date(r.createdAt).toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  {ceritakanAktivitas(r)}
                  {canOpen && (
                    <span className="ml-1.5 text-primary-ink underline">
                      lihat detail
                    </span>
                  )}
                </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ActivityDetailDialog row={detailRow} onClose={() => setDetailRow(null)} />
    </div>
  );
}
