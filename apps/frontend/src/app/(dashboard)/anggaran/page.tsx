"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TetapkanSaldoSheet } from "@/components/anggaran/tetapkan-saldo-sheet";
import type { Dana, SaldoNilai } from "@/components/anggaran/saldo-kegiatan";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { punyaRole } from "@/lib/role";
import { formatRupiah, formatRupiahShort } from "@/lib/format-rupiah";
import { useAuthStore } from "@/store/auth";
import type { Periode } from "@/types";

interface BarisKegiatan {
  kegiatanId: string;
  kode: string;
  nama: string;
  saldo: SaldoNilai | null;
  terpakai: Dana;
  proyek: number;
  balai: { balaiId: number; nama: string; proyek: number; terpakai: Dana }[];
}

const KOLOM = "grid-cols-[minmax(0,2.6fr)_6.5rem_6.5rem_6.5rem_minmax(0,1.4fr)_8.5rem]";

function Bar({ pct, lebih, redup }: { pct: number; lebih?: boolean; redup?: boolean }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
      <div
        className={cn("grafik-lebar h-full rounded-full", lebih ? "bg-destructive" : redup ? "bg-primary/40" : "bg-primary")}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/** Menu Anggaran Kegiatan: saldo per kegiatan per tahun & pemakaian per balai (hi-fi HfAnggaran). */
export default function AnggaranPage() {
  const { user } = useAuthStore();
  const bolehTetapkan = punyaRole(user, "ADMINISTRATOR");
  const [periode, setPeriode] = useState<Periode | null>(null);
  const [tahun, setTahun] = useState<number | null>(null);
  const [data, setData] = useState<BarisKegiatan[] | null>(null);
  const [buka, setBuka] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<{ id: string; nama: string } | null>(null);

  useEffect(() => {
    api
      .get<Periode[]>("/master/periodes")
      .then((r) => {
        const p = r.data.find((x) => x.isActive) ?? r.data[0];
        if (!p) return;
        setPeriode(p);
        const kini = new Date().getFullYear();
        setTahun(kini >= p.startYear && kini <= p.endYear ? kini : p.startYear);
      })
      .catch(() => toast.error("Gagal memuat periode"));
  }, []);

  const muat = useCallback(() => {
    if (!tahun) return;
    setData(null);
    api
      .get<BarisKegiatan[]>("/saldo-kegiatan", { params: { tahun } })
      .then((r) => setData(r.data))
      .catch(() => {
        setData([]);
        toast.error("Gagal memuat saldo kegiatan");
      });
  }, [tahun]);
  useEffect(muat, [muat]);

  const ringkas = useMemo(() => {
    const ada = (data ?? []).filter((k) => k.saldo);
    const saldo = ada.reduce((n, k) => n + k.saldo!.total, 0);
    const terpakai = (data ?? []).reduce((n, k) => n + k.terpakai.total, 0);
    const sisa = ada.reduce((n, k) => n + k.saldo!.total - k.terpakai.total, 0);
    return { saldo, terpakai, sisa, belum: (data ?? []).length - ada.length };
  }, [data]);

  const tahunList = periode
    ? Array.from({ length: periode.endYear - periode.startYear + 1 }, (_, i) => periode.startYear + i)
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Anggaran kegiatan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saldo ditetapkan per kegiatan per tahun; baris balai menunjukkan pemakaian
          </p>
        </div>
        <Select value={tahun ? String(tahun) : undefined} onValueChange={(v) => setTahun(Number(v))}>
          <SelectTrigger aria-label="Tahun" className="w-36">
            <SelectValue placeholder="Tahun" />
          </SelectTrigger>
          <SelectContent>
            {tahunList.map((t) => (
              <SelectItem key={t} value={String(t)}>
                Tahun {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          [ringkas.saldo, `Saldo semua kegiatan ${tahun ?? ""}`, ""],
          [ringkas.terpakai, "Terpakai (rencana, termasuk Draft)", ""],
          [ringkas.sisa, "Sisa", ringkas.sisa < 0 ? "text-destructive" : ""],
        ].map(([n, label, warna]) => (
          <div key={label as string} className="rounded-xl border bg-card px-4 py-3.5">
            <p className={cn("text-2xl font-bold tabular-nums", warna as string)} title={formatRupiah(n as number)}>
              {data ? formatRupiahShort(n as number) : "—"}
            </p>
            <p className="text-sm text-muted-foreground">{label as string}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="min-w-[56rem]">
          <div
            className={cn(
              "grid items-center gap-3 border-b px-4 py-2.5 text-xs font-semibold text-muted-foreground",
              KOLOM,
            )}
          >
            <span>Kegiatan › balai</span>
            <span className="text-right">Ditetapkan</span>
            <span className="text-right">Terpakai</span>
            <span className="text-right">Sisa</span>
            <span>Pemakaian</span>
            <span />
          </div>
          {!data &&
            [0, 1, 2].map((i) => (
              <div key={i} className="border-b px-4 py-4">
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))}
          {data?.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Belum ada kegiatan yang bisa Anda lihat. Kegiatan diatur di Master Data › Nomenklatur.
            </p>
          )}
          {data?.map((k) => {
            const o = buka.has(k.kegiatanId);
            const pct = k.saldo ? (k.terpakai.total / k.saldo.total) * 100 : 0;
            const sisa = k.saldo ? k.saldo.total - k.terpakai.total : null;
            return (
              <Fragment key={k.kegiatanId}>
                <div className={cn("grid items-center gap-3 border-b bg-tier-2 px-4 py-3 text-sm", KOLOM)}>
                  <button
                    type="button"
                    disabled={!k.balai.length}
                    aria-expanded={k.balai.length ? o : undefined}
                    onClick={() =>
                      setBuka((cur) => {
                        const n = new Set(cur);
                        if (n.has(k.kegiatanId)) n.delete(k.kegiatanId);
                        else n.add(k.kegiatanId);
                        return n;
                      })
                    }
                    className="flex min-w-0 items-start gap-2 text-left disabled:cursor-default"
                  >
                    <ChevronRight
                      size={15}
                      aria-hidden
                      className={cn(
                        "mt-0.5 shrink-0 text-muted-foreground transition-transform",
                        o && "rotate-90",
                        !k.balai.length && "invisible",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold" title={k.nama}>
                        {k.nama}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <span className="font-mono">{k.kegiatanId}</span> · {k.balai.length} balai · {k.proyek} proyek
                      </span>
                    </span>
                  </button>
                  <span className={cn("text-right tabular-nums", !k.saldo && "text-muted-foreground")}>
                    {k.saldo ? formatRupiahShort(k.saldo.total) : "belum"}
                  </span>
                  <span className="text-right tabular-nums">{formatRupiahShort(k.terpakai.total)}</span>
                  <span className={cn("text-right font-semibold tabular-nums", sisa != null && sisa < 0 && "text-destructive")}>
                    {sisa == null ? "—" : sisa < 0 ? `− ${formatRupiahShort(-sisa)}` : formatRupiahShort(sisa)}
                  </span>
                  {k.saldo ? (
                    <span className="flex items-center gap-2.5">
                      <Bar pct={pct} lebih={pct > 100} />
                      <span className={cn("w-10 text-right text-xs tabular-nums", pct > 90 && "font-semibold text-destructive")}>
                        {Math.round(pct)}%
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Saldo belum ditetapkan</span>
                  )}
                  <span className="text-right">
                    {bolehTetapkan && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => setEdit({ id: k.kegiatanId, nama: k.nama })}
                      >
                        <Wallet size={13} />
                        Tetapkan saldo
                      </Button>
                    )}
                  </span>
                </div>
                {o &&
                  k.balai.map((b) => {
                    const pb = k.saldo ? (b.terpakai.total / k.saldo.total) * 100 : 0;
                    return (
                      <div key={b.balaiId} className={cn("grid items-center gap-3 border-b px-4 py-2.5 text-sm", KOLOM)}>
                        <span className="min-w-0 pl-6">
                          <span className="block truncate" title={b.nama}>
                            {b.nama}
                          </span>
                          <span className="text-xs text-muted-foreground">{b.proyek} proyek</span>
                        </span>
                        <span />
                        <span className="text-right tabular-nums">{formatRupiahShort(b.terpakai.total)}</span>
                        <span />
                        {k.saldo ? (
                          <span className="flex items-center gap-2.5">
                            <Bar pct={pb} redup />
                            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                              {Math.round(pb)}%
                            </span>
                          </span>
                        ) : (
                          <span />
                        )}
                        <span />
                      </div>
                    );
                  })}
              </Fragment>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Paket yang membuat kegiatan melebihi saldo tidak bisa disimpan. Tahun yang saldonya belum ditetapkan tidak bisa
        diisi alokasinya.
      </p>

      {periode && (
        <TetapkanSaldoSheet
          kegiatan={edit}
          dari={periode.startYear}
          sampai={periode.endYear}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            muat();
          }}
        />
      )}
    </div>
  );
}
