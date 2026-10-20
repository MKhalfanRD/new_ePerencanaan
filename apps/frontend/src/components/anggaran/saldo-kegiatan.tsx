"use client";

import { useEffect, useState } from "react";
import { Lock, Wallet } from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatRupiah, formatRupiahShort } from "@/lib/format-rupiah";
import { SUMBER_DANA, type SumberDana } from "@/components/proyek/paket-template";

/**
 * Saldo anggaran kegiatan per tahun (flowchart-saldo-kegiatan.pdf). Aturan
 * sama dengan server (backend/src/saldo-kegiatan/saldo.ts): yang ditolak hanya
 * simpanan yang MENAMBAH pemakaian sampai melebihi saldo, atau tahun tanpa saldo.
 */
export type Dana = Record<SumberDana | "total", number>;
export type SaldoNilai = { total: number; alasan?: string | null } & Record<SumberDana, number | null>;
export type SaldoTahun = { tahun: number; saldo: SaldoNilai | null; terpakai: Dana };
export type BarisDana = { tahun: number } & Partial<Record<SumberDana, number | string | null>>;

export const LABEL_SD: Record<SumberDana, string> = { rm: "RM", rmp: "RMP", pln: "PLN", sbsn: "SBSN", kpbu: "KPBU" };
export const WARNA_SD: Record<SumberDana, string> = {
  rm: "bg-sd-rm",
  rmp: "bg-sd-rmp",
  pln: "bg-sd-pln",
  sbsn: "bg-sd-sbsn",
  kpbu: "bg-sd-kpbu",
};
const EPS = 1e-6;

export function danaTahun(rows: BarisDana[], tahun: number): Dana {
  const d: Dana = { rm: 0, rmp: 0, pln: 0, sbsn: 0, kpbu: 0, total: 0 };
  for (const r of rows)
    if (r.tahun === tahun)
      for (const k of SUMBER_DANA) {
        d[k] += Number(r[k] ?? 0);
        d.total += Number(r[k] ?? 0);
      }
  return d;
}

/** Saldo & pemakaian kegiatan per tahun. `kecualiProyek`: proyek yang paketnya dijumlah sendiri di form. */
export function useSaldoKegiatan(
  kegiatanId: string | null | undefined,
  dari: number | undefined,
  sampai: number | undefined,
  kecualiProyek?: string,
  aktif = true,
) {
  const [data, setData] = useState<SaldoTahun[] | null>(null);
  useEffect(() => {
    if (!aktif || !kegiatanId || !dari || !sampai) return;
    let batal = false;
    api
      .get<SaldoTahun[]>(`/saldo-kegiatan/${kegiatanId}`, {
        params: { dari, sampai, kecualiProyek: kecualiProyek || undefined },
      })
      .then((r) => !batal && setData(r.data))
      .catch(() => !batal && setData([]));
    return () => {
      batal = true;
    };
  }, [aktif, kegiatanId, dari, sampai, kecualiProyek]);
  return data;
}

export interface BarisSaldo {
  label: string;
  sd?: SumberDana;
  saldo: number;
  lain: number;
  ini: number;
  lebih: boolean;
}

/**
 * Bar per tahun: total kegiatan + tiap sumber dana yang dipecah admin.
 * `lain` = pemakaian kegiatan di luar paket ini; `ini` = paket/proyek ini;
 * `lama` = nilai ini sebelum diubah (lebih hanya kalau menambah).
 */
export function hitungSaldo(s: SaldoTahun | undefined, lain: Dana, ini: Dana, lama?: Dana): BarisSaldo[] | null {
  if (!s?.saldo) return null;
  const naik = (k: SumberDana | "total") => ini[k] - (lama?.[k] ?? 0) > EPS;
  const baris: BarisSaldo[] = [
    {
      label: "Total kegiatan",
      saldo: s.saldo.total,
      lain: lain.total,
      ini: ini.total,
      lebih: naik("total") && lain.total + ini.total > s.saldo.total + EPS,
    },
  ];
  for (const k of SUMBER_DANA) {
    const v = s.saldo[k];
    if (v == null) continue;
    baris.push({ label: LABEL_SD[k], sd: k, saldo: v, lain: lain[k], ini: ini[k], lebih: naik(k) && lain[k] + ini[k] > v + EPS });
  }
  return baris;
}

const pct = (n: number, d: number) => (d > 0 ? Math.max(0, Math.min(100, (n / d) * 100)) : 0);

/** Bar saldo 1 tahun (hi-fi HfFormPaket2). */
export function BarSaldo({ baris, labelLain = "lain", labelIni = "ini" }: { baris: BarisSaldo[]; labelLain?: string; labelIni?: string }) {
  return (
    <div className="space-y-1.5 rounded-md bg-tier-2 px-3 py-2.5">
      {baris.map((b) => {
        const sisa = b.saldo - b.lain - b.ini;
        const wLain = pct(b.lain, b.saldo);
        const wIni = Math.min(pct(b.ini, b.saldo), 100 - wLain);
        return (
          <div
            key={b.label}
            className="grid grid-cols-1 items-center gap-x-3 gap-y-1 text-[11.5px] sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]"
          >
            <span className={cn("flex items-center gap-1.5", !b.sd && "font-semibold")}>
              {b.sd && <i aria-hidden className={cn("h-2 w-2 rounded-[2px]", WARNA_SD[b.sd])} />}
              {b.label}
              {b.sd && <span className="text-muted-foreground">dipecah</span>}
            </span>
            <div
              className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-border"
              role="img"
              aria-label={`${b.label}: ${labelLain} ${formatRupiah(b.lain)}, ${labelIni} ${formatRupiah(b.ini)}, saldo ${formatRupiah(b.saldo)}`}
            >
              <span className="grafik-lebar bg-input" style={{ width: `${wLain}%` }} />
              <span
                className={cn("grafik-lebar", b.lebih ? "bg-destructive" : b.sd ? WARNA_SD[b.sd] : "bg-primary")}
                style={{ width: `${b.lebih ? 100 - wLain : wIni}%` }}
              />
            </div>
            <span className="flex flex-wrap justify-end gap-x-3 tabular-nums">
              <span className="text-muted-foreground">
                saldo <b className="text-foreground">{formatRupiahShort(b.saldo)}</b> · {labelLain}{" "}
                <b className="text-foreground">{formatRupiahShort(b.lain)}</b> · {labelIni}{" "}
                <b className="text-foreground">{formatRupiahShort(b.ini)}</b>
              </span>
              <b className={cn("min-w-24 text-right", sisa < -EPS ? "text-destructive" : "text-primary-ink")}>
                {sisa < -EPS ? `Lebih ${formatRupiahShort(-sisa)}` : `Sisa ${formatRupiahShort(sisa)}`}
              </b>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TahunTerkunci({ kegiatanId, tahun }: { kegiatanId: string; tahun: number }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-dashed bg-tier-2 px-3 py-2.5 text-xs">
      <Lock size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <p className="font-semibold">
          Saldo kegiatan {kegiatanId} tahun {tahun} belum ditetapkan
        </p>
        <p className="text-muted-foreground">
          Alokasi tahun ini belum bisa diisi. Hubungi admin untuk menetapkan saldo di menu Anggaran Kegiatan.
        </p>
      </div>
    </div>
  );
}

/** Tab Pemaketan: saldo kegiatan per tahun vs proyek lain & paket proyek ini. */
export function RingkasSaldoProyek({
  kegiatanId,
  dari,
  sampai,
  proyekId,
  alokasi,
}: {
  kegiatanId: string;
  dari?: number;
  sampai?: number;
  proyekId?: string;
  alokasi: BarisDana[];
}) {
  const data = useSaldoKegiatan(kegiatanId, dari, sampai, proyekId);
  if (!data) return null;
  const belum = data.filter((s) => !s.saldo).map((s) => s.tahun);
  return (
    <div className="space-y-2.5 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Saldo kegiatan {kegiatanId}</p>
        <p className="text-xs text-muted-foreground">Dibagi semua balai di kegiatan ini, termasuk proyek Draft</p>
      </div>
      {data
        .filter((s) => s.saldo)
        .map((s) => (
          <div key={s.tahun} className="space-y-1">
            <p className="text-xs font-semibold">{s.tahun}</p>
            <BarSaldo
              baris={hitungSaldo(s, s.terpakai, danaTahun(alokasi, s.tahun))!}
              labelLain="proyek lain"
              labelIni="proyek ini"
            />
          </div>
        ))}
      {belum.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock size={12} aria-hidden />
          Saldo {belum.join(", ")} belum ditetapkan admin. Alokasi tahun itu belum bisa diisi.
        </p>
      )}
    </div>
  );
}

/** Kotak info saldo 1 tahun (hi-fi HfForm00/HfForm01): saldo, tersedia, atau belum ditetapkan. */
export function InfoSaldoKegiatan({
  kegiatanId,
  tahun,
  kecualiProyek,
  aksen,
}: {
  kegiatanId: string;
  tahun: number;
  kecualiProyek?: string;
  /** Latar oranye lembut (di dalam form); default netral. */
  aksen?: boolean;
}) {
  const data = useSaldoKegiatan(kegiatanId, tahun, tahun, kecualiProyek);
  if (!data) return null;
  const s = data[0];
  const tersedia = s?.saldo ? s.saldo.total - s.terpakai.total : null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3.5 py-3 text-[13.5px]",
        aksen ? "bg-primary-soft text-primary-ink" : "bg-tier-1",
      )}
    >
      <Wallet size={16} aria-hidden className="shrink-0" />
      {s?.saldo ? (
        <span>
          Saldo kegiatan {kegiatanId} · {tahun} tersedia{" "}
          <b className={cn(tersedia! < 0 && "text-destructive")}>{formatRupiahShort(tersedia!)}</b> dari{" "}
          {formatRupiahShort(s.saldo.total)}
        </span>
      ) : (
        <span>
          Saldo kegiatan {kegiatanId} · {tahun} belum ditetapkan admin. Alokasi paket tahun itu belum bisa diisi.
        </span>
      )}
    </div>
  );
}
