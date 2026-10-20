"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AngkaInput } from "./paket-dialog";
import { SUMBER_DANA, type SumberDana } from "./paket-template";
import { LABEL_SD, WARNA_SD } from "@/components/anggaran/saldo-kegiatan";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatRupiahShort } from "@/lib/format-rupiah";

type Baris = Partial<Record<SumberDana, string | number>> & { total: string | number };

/**
 * Baris realisasi 1 tahun di bawah rencananya (hi-fi HfDetail,
 * flowchart-realisasi.pdf). Tiap sumber dana <= rencananya; kosong = hapus.
 */
export function RealisasiBaris({
  paketId,
  tahun,
  rencana,
  realisasi,
  bisaIsi,
  alasanTidak,
  onSaved,
}: {
  paketId: string;
  tahun: number;
  rencana: Baris;
  realisasi?: Baris;
  bisaIsi: boolean;
  /** Ditampilkan bila tidak bisa diisi & belum ada realisasi. */
  alasanTidak?: string;
  onSaved: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [isi, setIsi] = useState<Partial<Record<SumberDana, number>>>({});
  const [simpan, setSimpan] = useState(false);
  // Sumber dana yang ditampilkan: yang ada di rencana atau sudah punya realisasi.
  const sd = SUMBER_DANA.filter((k) => Number(rencana[k] ?? 0) > 0 || Number(realisasi?.[k] ?? 0) > 0);
  const totalRencana = Number(rencana.total);
  const totalReal = realisasi ? Number(realisasi.total) : 0;

  const mulai = () => {
    setIsi(Object.fromEntries(sd.map((k) => [k, realisasi ? Number(realisasi[k] ?? 0) : undefined])));
    setEdit(true);
  };
  const lebih = (k: SumberDana) => (isi[k] ?? 0) > Number(rencana[k] ?? 0);
  const adaLebih = sd.some(lebih);
  const kirim = async (nilai: Partial<Record<SumberDana, number>>) => {
    setSimpan(true);
    try {
      await api.patch(`/paket/${paketId}/realisasi`, { tahun, ...nilai });
      toast.success(`Realisasi ${tahun} disimpan`);
      setEdit(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan realisasi");
    } finally {
      setSimpan(false);
    }
  };

  if (edit)
    return (
      <div className="w-full space-y-2.5 border-t border-dashed bg-tier-2 px-3.5 py-3">
        <p className="text-xs font-semibold">Realisasi {tahun}</p>
        <div className="flex flex-wrap gap-3">
          {sd.map((k) => (
            <div key={k} className="space-y-1">
              <div
                className={cn(
                  "flex w-[12.5rem] items-center rounded-md border bg-background",
                  lebih(k) && "border-destructive",
                )}
              >
                <span className="flex w-16 shrink-0 items-center gap-1.5 border-r px-2 text-[11px] font-semibold text-muted-foreground">
                  <i aria-hidden className={cn("h-2 w-2 rounded-[2px]", WARNA_SD[k])} />
                  {LABEL_SD[k]}
                </span>
                <AngkaInput
                  aria-label={`Realisasi ${LABEL_SD[k]} ${tahun}`}
                  className="h-8 border-0 text-xs shadow-none focus-visible:ring-0"
                  placeholder="0"
                  value={isi[k]}
                  onChange={(v) => setIsi((c) => ({ ...c, [k]: v }))}
                />
              </div>
              <p className={cn("text-[11px]", lebih(k) ? "font-medium text-destructive" : "text-muted-foreground")}>
                {lebih(k) ? "Melebihi" : "dari"} rencana {formatRupiahShort(Number(rencana[k] ?? 0))}
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={simpan || adaLebih} onClick={() => kirim(isi)}>
            {simpan && <Loader2 size={13} className="mr-1.5 animate-spin" />}
            Simpan
          </Button>
          <Button size="sm" variant="outline" disabled={simpan} onClick={() => setEdit(false)}>
            Batal
          </Button>
          {realisasi && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={simpan}
              onClick={() => kirim({})}
            >
              Kosongkan realisasi
            </Button>
          )}
          {adaLebih && <span className="text-xs text-destructive">Realisasi tidak boleh melebihi rencana.</span>}
        </div>
      </div>
    );

  return (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-t border-dashed px-3.5 py-2 text-[13px]">
      <span className="w-12 text-xs text-muted-foreground">Realisasi</span>
      {realisasi ? (
        <>
          <span className="flex flex-1 flex-wrap gap-x-3">
            {sd
              .filter((k) => Number(realisasi[k] ?? 0) > 0)
              .map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <i aria-hidden className={cn("h-2 w-2 rounded-[2px]", WARNA_SD[k])} />
                  {LABEL_SD[k]} <b className="tabular-nums">{formatRupiahShort(Number(realisasi[k]))}</b>
                </span>
              ))}
            <span className="text-muted-foreground">
              · selisih {totalReal - totalRencana === 0 ? "0" : `−${formatRupiahShort(totalRencana - totalReal)}`}
            </span>
          </span>
          <b className="tabular-nums">{formatRupiahShort(totalReal)}</b>
          {bisaIsi && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={mulai}>
              <Pencil size={12} className="mr-1" /> Ubah
            </Button>
          )}
        </>
      ) : bisaIsi ? (
        <>
          <span className="flex-1 text-muted-foreground">Belum diisi</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={mulai}>
            <Plus size={12} className="mr-1" /> Isi realisasi
          </Button>
        </>
      ) : (
        <span className="flex-1 text-muted-foreground">Belum diisi{alasanTidak ? ` · ${alasanTidak}` : ""}</span>
      )}
    </div>
  );
}
