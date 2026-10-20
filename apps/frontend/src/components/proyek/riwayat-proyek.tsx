"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { waktuSingkat } from "@/lib/alur-status";

interface Perubahan {
  key: string;
  bagian: string;
  kolom: string;
  sebelum: string | null;
  sesudah: string | null;
}
interface Entri {
  id: string;
  aksi: string;
  catatan: string | null;
  perubahan: Perubahan[];
  createdAt: string;
  user: { name: string; role?: { name: string } | null } | null;
}

const SEMUA = "__semua";
const TAMPIL = 3;
// Titik warna per jenis aksi: pengembalian merah, persetujuan hijau, lainnya netral/aksen.
const warnaTitik = (aksi: string) =>
  /Dikembalikan|Perlu revisi/.test(aksi)
    ? "bg-destructive"
    : /Disetujui|Sesuai/.test(aksi)
      ? "bg-ok"
      : /Realisasi|paket|proyek|dokumen/i.test(aksi)
        ? "bg-primary"
        : "bg-st-draft";

/**
 * Riwayat proyek berlabel (khusus admin) — panel kanan detail proyek
 * (hi-fi HfDetail, flowchart-riwayat-proyek.pdf).
 */
export function RiwayatProyek({ proyekId, versi }: { proyekId: string; versi?: string }) {
  const [data, setData] = useState<Entri[] | null>(null);
  const [bagian, setBagian] = useState("");
  const [buka, setBuka] = useState<Set<string>>(new Set());

  useEffect(() => {
    api
      .get<Entri[]>(`/proyek/${proyekId}/riwayat`)
      .then((r) => setData(r.data))
      .catch(() => setData([]));
  }, [proyekId, versi]);

  const daftarBagian = useMemo(
    () => [...new Set((data ?? []).flatMap((e) => e.perubahan.map((p) => p.bagian)))].sort((a, b) => a.localeCompare(b, "id")),
    [data],
  );
  const terlihat = (data ?? [])
    .map((e) => ({ ...e, perubahan: bagian ? e.perubahan.filter((p) => p.bagian === bagian) : e.perubahan }))
    .filter((e) => !bagian || e.perubahan.length > 0);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-sm font-semibold">Riwayat proyek</h3>
        <span className="rounded-full bg-tier-1 px-2 py-0.5 text-[11px] text-muted-foreground">hanya admin</span>
      </div>
      {daftarBagian.length > 1 && (
        <Select value={bagian || SEMUA} onValueChange={(v) => setBagian(v === SEMUA ? "" : v)}>
          <SelectTrigger aria-label="Bagian riwayat" className="h-9 w-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEMUA}>Semua bagian</SelectItem>
            {daftarBagian.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {!data ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-muted-foreground" size={18} />
        </div>
      ) : terlihat.length === 0 ? (
        <p className="border-t py-6 text-center text-xs text-muted-foreground">
          {data.length ? "Tidak ada perubahan di bagian ini." : "Belum ada riwayat. Perubahan proyek tercatat mulai 20 Okt 2026."}
        </p>
      ) : (
        <ol className="divide-y border-t">
          {terlihat.map((e) => {
            const semua = buka.has(e.id);
            const baris = semua ? e.perubahan : e.perubahan.slice(0, TAMPIL);
            return (
              <li key={e.id} className="flex gap-2.5 py-2.5 text-[13px]">
                <span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", warnaTitik(e.aksi))} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p>
                    <b>{e.user?.name ?? "Sistem"}</b>
                    {e.user?.role?.name && <span className="text-muted-foreground"> ({e.user.role.name})</span>}
                    <span className="text-muted-foreground"> · {waktuSingkat(e.createdAt)}</span>
                  </p>
                  <p className="font-medium">{e.aksi}</p>
                  {e.catatan && <p className="text-muted-foreground">&ldquo;{e.catatan}&rdquo;</p>}
                  {baris.map((p) => (
                    <p key={p.key} className="break-words text-muted-foreground">
                      {p.kolom}:{" "}
                      {p.sebelum == null ? (
                        <span className="text-ok">+ {p.sesudah}</span>
                      ) : p.sesudah == null ? (
                        <span className="text-destructive line-through">{p.sebelum}</span>
                      ) : (
                        <>
                          {p.sebelum} → <b className="text-foreground">{p.sesudah}</b>
                        </>
                      )}
                    </p>
                  ))}
                  {e.perubahan.length > TAMPIL && (
                    <button
                      type="button"
                      className="text-xs text-primary-ink underline underline-offset-2"
                      onClick={() =>
                        setBuka((c) => {
                          const n = new Set(c);
                          if (n.has(e.id)) n.delete(e.id);
                          else n.add(e.id);
                          return n;
                        })
                      }
                    >
                      {semua ? "Ringkas" : `Lihat semua (${e.perubahan.length})`}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
