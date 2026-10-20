"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { statusConfig } from "@/components/shared/status-config";
import type { Dana, SaldoNilai } from "@/components/anggaran/saldo-kegiatan";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { PetaMini, type LokasiRingkas } from "@/components/map/peta-mini";
import { punyaRole } from "@/lib/role";
import { formatRupiah, formatRupiahShort } from "@/lib/format-rupiah";
import { useAuthStore } from "@/store/auth";
import type { Proyek } from "@/types";

/** Dashboard (hi-fi HfDashboard): saldo kegiatan, realisasi, tindakan, rekap. */
interface Ringkasan {
  jumlahProyek: number;
  perStatus: Partial<Record<Proyek["status"], number>>;
  alokasi: ({ tahun: number; status: "RENCANA" | "REALISASI" } & Dana)[];
  lokasi: LokasiRingkas[];
  terbaru: {
    id: string;
    projectName: string;
    status: Proyek["status"];
    balai: { name: string; shortName?: string | null };
    periode: { label: string };
  }[];
  realisasiBelum: number;
  periodeAktif: string | null;
}
interface SaldoKeg {
  kegiatanId: string;
  nama: string;
  saldo: SaldoNilai | null;
  terpakai: Dana;
}
interface PakaiProyek {
  proyekId: string;
  kodeProyek: string | null;
  nama: string;
  balai: string;
  terpakai: number;
  paket: { id: string; nama: string; terpakai: number }[];
}

const SD = [
  ["rm", "RM", "var(--color-sd-rm)"],
  ["sbsn", "SBSN", "var(--color-sd-sbsn)"],
  ["pln", "PLN", "var(--color-sd-pln)"],
  ["rmp", "RMP", "var(--color-sd-rmp)"],
  ["kpbu", "KPBU", "var(--color-sd-kpbu)"],
] as const;
const WARNA_STATUS: Record<Proyek["status"], string> = {
  APPROVED: "var(--color-st-disetujui)",
  DIAJUKAN: "var(--color-st-diajukan)",
  DIPERIKSA: "var(--color-warn)",
  DRAFT: "var(--color-st-draft)",
  DIKEMBALIKAN: "var(--color-st-dikembalikan)",
};
const M = (n: number) => formatRupiahShort(n).replace(/^Rp\s?/, "");
const persen = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

function Cincin({
  pct,
  ukuran,
  tebal,
  besar,
  kecil,
  warna = "var(--color-sd-rm)",
}: {
  pct: number;
  ukuran: number;
  tebal: number;
  besar: string;
  kecil?: string;
  warna?: string;
}) {
  const r = (ukuran - tebal) / 2;
  const k = 2 * Math.PI * r;
  const isi = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: ukuran, height: ukuran }}>
      <svg width={ukuran} height={ukuran} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={ukuran / 2} cy={ukuran / 2} r={r} fill="none" strokeWidth={tebal} className="stroke-border" />
        {isi > 0 && (
          <circle
            cx={ukuran / 2}
            cy={ukuran / 2}
            r={r}
            fill="none"
            strokeWidth={tebal}
            strokeLinecap="round"
            className="grafik-cincin"
            stroke={pct > 100 ? "var(--color-destructive)" : warna}
            strokeDasharray={`${(k * isi) / 100} ${k}`}
          />
        )}
      </svg>
      <div className="text-center" role="img" aria-label={`${besar}${kecil ? ` ${kecil}` : ""}`}>
        <p className="font-bold leading-none tabular-nums" style={{ fontSize: ukuran / 4.6 }}>
          {besar}
        </p>
        {kecil && <p className="mt-1 text-xs text-muted-foreground">{kecil}</p>}
      </div>
    </div>
  );
}

/** Donat bertumpuk (sumber dana, status). */
function Donat({ bagian, ukuran = 140, tengah, bawah }: { bagian: { nilai: number; warna: string }[]; ukuran?: number; tengah: string; bawah: string }) {
  const tebal = 22;
  const r = (ukuran - tebal) / 2;
  const k = 2 * Math.PI * r;
  const total = bagian.reduce((s, b) => s + b.nilai, 0);
  let lewat = 0;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: ukuran, height: ukuran }}>
      <svg width={ukuran} height={ukuran} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={ukuran / 2} cy={ukuran / 2} r={r} fill="none" strokeWidth={tebal} className="stroke-border" />
        {total > 0 &&
          bagian.map((b, i) => {
            const panjang = (k * b.nilai) / total;
            const el = (
              <circle
                key={i}
                cx={ukuran / 2}
                cy={ukuran / 2}
                r={r}
                fill="none"
                strokeWidth={tebal}
                stroke={b.warna}
                className="grafik-cincin"
                style={{ animationDelay: `${i * 120}ms` }}
                strokeDasharray={`${Math.max(0, panjang - 2)} ${k}`}
                strokeDashoffset={-lewat}
              />
            );
            lewat += panjang;
            return el;
          })}
      </svg>
      <div className="text-center">
        <p className="text-xl font-bold tabular-nums">{tengah}</p>
        <p className="text-xs text-muted-foreground">{bawah}</p>
      </div>
    </div>
  );
}

function Bar({ pct, warna = "bg-sd-rm" }: { pct: number; warna?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-border">
      <div className={cn("grafik-lebar h-full rounded-full", pct > 100 ? "bg-destructive" : warna)} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const admin = punyaRole(user, "ADMINISTRATOR");
  const pemeriksa = punyaRole(user, "VERIFICATOR", "OPERATOR");
  const tahunIni = new Date().getFullYear();
  const [r, setR] = useState<Ringkasan | null>(null);
  const [tahun, setTahun] = useState<number | "semua">("semua");
  const [saldo, setSaldo] = useState<SaldoKeg[] | null>(null);
  const [pilihKeg, setPilihKeg] = useState<string | null>(null);
  const [semuaKeg, setSemuaKeg] = useState(false);
  const [pakai, setPakai] = useState<PakaiProyek[] | null>(null);
  const [bukaProyek, setBukaProyek] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Ringkasan>("/proyek/ringkasan")
      .then((res) => setR(res.data))
      .catch(() => setR(null));
  }, []);

  const tahunList = useMemo(() => {
    const m = r?.periodeAktif?.match(/(\d{4})\D+(\d{4})/);
    if (m) return Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i);
    return [...new Set((r?.alokasi ?? []).map((a) => a.tahun))].sort();
  }, [r]);
  // Saldo selalu per tahun: "Semua tahun" memakai tahun berjalan.
  const tahunSaldo = tahun === "semua" ? tahunIni : tahun;

  useEffect(() => {
    setSaldo(null);
    api
      .get<SaldoKeg[]>("/saldo-kegiatan", { params: { tahun: tahunSaldo } })
      .then((res) => {
        const data = res.data
          .filter((k) => k.saldo || k.terpakai.total > 0)
          .sort((a, b) => Number(!!b.saldo) - Number(!!a.saldo) || b.terpakai.total - a.terpakai.total);
        setSaldo(data);
        setPilihKeg((cur) => (data.some((k) => k.kegiatanId === cur) ? cur : (data[0]?.kegiatanId ?? null)));
      })
      .catch(() => setSaldo([]));
  }, [tahunSaldo]);

  useEffect(() => {
    if (!pilihKeg) return setPakai(null);
    setPakai(null);
    setBukaProyek(null);
    api
      .get<PakaiProyek[]>(`/saldo-kegiatan/${pilihKeg}/proyek`, { params: { tahun: tahunSaldo } })
      .then((res) => setPakai(res.data))
      .catch(() => setPakai([]));
  }, [pilihKeg, tahunSaldo]);

  const alokasi = useMemo(
    () => (r?.alokasi ?? []).filter((a) => tahun === "semua" || a.tahun === tahun),
    [r, tahun],
  );
  const jumlah = (status: "RENCANA" | "REALISASI", k: keyof Dana = "total") =>
    alokasi.filter((a) => a.status === status).reduce((s, a) => s + a[k], 0);
  const rencana = jumlah("RENCANA");
  const realisasi = jumlah("REALISASI");
  const realisasiTahunSaldo = (r?.alokasi ?? [])
    .filter((a) => a.status === "REALISASI" && a.tahun === tahunSaldo)
    .reduce((s, a) => s + a.total, 0);

  const adaSaldo = (saldo ?? []).filter((k) => k.saldo);
  const totalSaldo = adaSaldo.reduce((s, k) => s + k.saldo!.total, 0);
  const terpakai = adaSaldo.reduce((s, k) => s + k.terpakai.total, 0);
  const kegTampil = semuaKeg ? (saldo ?? []) : (saldo ?? []).slice(0, 6);
  const kegDipilih = saldo?.find((k) => k.kegiatanId === pilihKeg);

  const ps = r?.perStatus ?? {};
  const tindakan = [
    (admin || pemeriksa) && ["Menunggu diperiksa", ps.DIAJUKAN ?? 0, "/pemeriksaan"],
    ["Dikembalikan untuk revisi", ps.DIKEMBALIKAN ?? 0, "/proyek"],
    admin && ["Menunggu keputusan admin", ps.DIPERIKSA ?? 0, "/pemeriksaan"],
    ["Realisasi belum diisi", r?.realisasiBelum ?? 0, "/proyek"],
  ].filter(Boolean) as [string, number, string][];

  const perTahun = tahunList.map((t) => ({
    tahun: t,
    rencana: (r?.alokasi ?? []).filter((a) => a.tahun === t && a.status === "RENCANA").reduce((s, a) => s + a.total, 0),
    realisasi: (r?.alokasi ?? []).filter((a) => a.tahun === t && a.status === "REALISASI").reduce((s, a) => s + a.total, 0),
  }));
  const maksTahun = Math.max(1, ...perTahun.map((x) => Math.max(x.rencana, x.realisasi)));

  return (
    <div className="space-y-6">
      {/* Kepala + pilihan tahun */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selamat datang, {user?.name}
            {r?.periodeAktif && ` · Periode aktif ${r.periodeAktif}`}
          </p>
        </div>
        <div role="group" aria-label="Tahun" className="flex flex-wrap gap-1.5">
          {(["semua", ...tahunList] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tahun === t}
              onClick={() => setTahun(t)}
              className={cn(
                "h-8 rounded-full border px-3 text-[13px] transition-colors",
                tahun === t ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-accent",
              )}
            >
              {t === "semua" ? "Semua tahun" : t === tahunIni ? `${t} (berjalan)` : t}
            </button>
          ))}
        </div>
      </div>

      {/* Saldo semua kegiatan + realisasi terhadap rencana */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-wrap items-center gap-6 rounded-2xl border bg-card p-6">
          <Cincin
            pct={persen(terpakai, totalSaldo)}
            ukuran={168}
            tebal={16}
            besar={totalSaldo ? `${persen(terpakai, totalSaldo)}%` : "—"}
            kecil="saldo terpakai"
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-[13px] text-muted-foreground">Saldo anggaran semua kegiatan · {tahunSaldo}</p>
              <p className="text-3xl font-bold tabular-nums" title={formatRupiah(totalSaldo)}>
                {saldo ? formatRupiahShort(totalSaldo) : "—"}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-[13px]">
              {[
                ["Terpakai", terpakai],
                ["Realisasi", realisasiTahunSaldo],
                ["Sisa", totalSaldo - terpakai],
              ].map(([l, n]) => (
                <div key={l as string}>
                  <p className="text-muted-foreground">{l}</p>
                  <p className={cn("font-semibold tabular-nums", (n as number) < 0 && "text-destructive")}>{M(n as number)}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Terpakai = rencana paket sejak disimpan (termasuk Draft); tahun yang sudah ada realisasinya memakai realisasi.
              {saldo && saldo.length > adaSaldo.length && ` ${saldo.length - adaSaldo.length} kegiatan belum punya saldo ${tahunSaldo}.`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-2xl border bg-card p-6">
          <Cincin pct={persen(realisasi, rencana)} ukuran={128} tebal={13} besar={`${persen(realisasi, rencana)}%`} kecil="dari rencana" />
          <div className="space-y-1 text-[13.5px]">
            <p className="text-muted-foreground">Realisasi terhadap rencana{tahun !== "semua" && ` · ${tahun}`}</p>
            <p>
              Rencana <b className="tabular-nums">{M(rencana)}</b>
            </p>
            <p>
              Realisasi <b className="tabular-nums">{M(realisasi)}</b>
            </p>
            <p className="text-muted-foreground">{r?.realisasiBelum ?? 0} paket-tahun belum diisi realisasi</p>
          </div>
        </div>
      </div>

      {/* Perlu tindakan */}
      <section className="space-y-2.5">
        <h2 className="text-base font-semibold">Perlu tindakan Anda</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tindakan.map(([label, n, href]) => (
            <Link
              key={label}
              href={href}
              className="flex items-center justify-between rounded-xl border bg-card px-4 py-4 text-sm transition-colors hover:bg-accent"
            >
              {label}
              <b className={cn("text-xl tabular-nums", n > 0 && label.startsWith("Dikembalikan") && "text-destructive")}>{n}</b>
            </Link>
          ))}
        </div>
      </section>

      {/* Saldo per kegiatan + rincian kegiatan terpilih */}
      <section className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Saldo per kegiatan · {tahunSaldo}</h2>
          <p className="text-xs text-muted-foreground">Lingkaran = bagian saldo yang terpakai · klik untuk rincian</p>
        </div>
        {saldo?.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Belum ada saldo maupun pemakaian di tahun {tahunSaldo}.{" "}
            {admin && (
              <Link href="/anggaran" className="text-primary-ink underline">
                Tetapkan saldo di Anggaran Kegiatan
              </Link>
            )}
          </p>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {!saldo &&
                  [0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}
                {kegTampil.map((k) => {
                  const pct = k.saldo ? persen(k.terpakai.total, k.saldo.total) : 0;
                  return (
                    <button
                      key={k.kegiatanId}
                      type="button"
                      aria-pressed={pilihKeg === k.kegiatanId}
                      onClick={() => setPilihKeg(k.kegiatanId)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors hover:bg-accent/50",
                        pilihKeg === k.kegiatanId && "border-primary ring-1 ring-primary",
                      )}
                    >
                      {k.saldo ? (
                        <Cincin pct={pct} ukuran={76} tebal={8} besar={`${pct}%`} />
                      ) : (
                        <span className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full border-[8px] border-border text-[11px] text-muted-foreground">
                          belum
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block font-mono text-xs text-muted-foreground">{k.kegiatanId}</span>
                        <span className="line-clamp-3 text-[13.5px] font-semibold leading-snug" title={k.nama}>
                          {k.nama}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {k.saldo ? (
                            <>
                              Sisa <b className={cn("text-foreground", k.saldo.total < k.terpakai.total && "text-destructive")}>{M(k.saldo.total - k.terpakai.total)}</b> dari{" "}
                              {M(k.saldo.total)}
                            </>
                          ) : (
                            <>Terpakai {M(k.terpakai.total)} · saldo belum ditetapkan</>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {(saldo?.length ?? 0) > 6 && (
                <button
                  type="button"
                  onClick={() => setSemuaKeg((v) => !v)}
                  className="w-full rounded-xl border bg-card py-2.5 text-sm font-medium hover:bg-accent"
                >
                  {semuaKeg ? "Tampilkan lebih sedikit" : `Tampilkan ${(saldo?.length ?? 0) - 6} kegiatan lainnya`}
                </button>
              )}
            </div>

            {kegDipilih && (
              <div className="space-y-3 rounded-xl border bg-card p-4">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{kegDipilih.kegiatanId} · dipilih</p>
                  <p className="font-semibold">{kegDipilih.nama}</p>
                  <p className="text-xs text-muted-foreground">Pemakaian per proyek · klik proyek untuk rincian paket</p>
                </div>
                {!pakai ? (
                  <div className="h-24 animate-pulse rounded-lg bg-muted" />
                ) : pakai.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada proyek yang memakai saldo {tahunSaldo}.</p>
                ) : (
                  <ul className="divide-y">
                    {pakai.map((p) => {
                      const dasar = kegDipilih.saldo?.total ?? kegDipilih.terpakai.total;
                      const buka = bukaProyek === p.proyekId;
                      return (
                        <li key={p.proyekId} className="py-2.5">
                          <button
                            type="button"
                            aria-expanded={buka}
                            onClick={() => setBukaProyek(buka ? null : p.proyekId)}
                            className="w-full space-y-1.5 text-left"
                          >
                            <span className="flex items-start gap-2 text-[13px]">
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold">{p.nama}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {p.balai} · {M(p.terpakai)} · {persen(p.terpakai, dasar)}%
                                </span>
                              </span>
                              <ChevronRight size={14} className={cn("mt-0.5 shrink-0 text-muted-foreground transition-transform", buka && "rotate-90")} />
                            </span>
                            <Bar pct={persen(p.terpakai, dasar)} />
                          </button>
                          {buka && (
                            <ul className="mt-2 space-y-1.5 border-l-2 border-border pl-3">
                              {p.paket.map((k) => (
                                <li key={k.id} className="text-xs">
                                  <span className="flex justify-between gap-2">
                                    <span className="truncate">{k.nama}</span>
                                    <b className="tabular-nums">{M(k.terpakai)}</b>
                                  </span>
                                  <Bar pct={persen(k.terpakai, dasar)} warna="bg-sd-rm/60" />
                                </li>
                              ))}
                              <li>
                                <Link href={`/proyek?id=${p.proyekId}`} className="text-xs text-primary-ink underline">
                                  Buka proyek
                                </Link>
                              </li>
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Rekap: sumber dana, status, per tahun */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <h2 className="text-base font-semibold">Rencana per sumber dana</h2>
          <div className="flex flex-wrap items-center gap-5">
            <Donat
              bagian={SD.map(([k, , w]) => ({ nilai: jumlah("RENCANA", k), warna: w }))}
              tengah={M(rencana)}
              bawah="total rencana"
            />
            <ul className="min-w-0 flex-1 space-y-1.5 text-[13px]">
              {SD.map(([k, l, w]) => (
                <li key={k} className="grid grid-cols-[0.6rem_3rem_1fr_2.5rem] items-center gap-2">
                  <i aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: w }} />
                  <span>{l}</span>
                  <b className="text-right tabular-nums">{M(jumlah("RENCANA", k))}</b>
                  <span className="text-right text-xs text-muted-foreground tabular-nums">
                    {persen(jumlah("RENCANA", k), rencana)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <h2 className="text-base font-semibold">Status proyek</h2>
          <div className="flex flex-wrap items-center gap-5">
            <Donat
              bagian={(Object.keys(statusConfig) as Proyek["status"][]).map((s) => ({ nilai: ps[s] ?? 0, warna: WARNA_STATUS[s] }))}
              tengah={String(r?.jumlahProyek ?? 0)}
              bawah="proyek"
            />
            <ul className="min-w-0 flex-1 space-y-1.5 text-[13px]">
              {(Object.keys(statusConfig) as Proyek["status"][]).map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <i aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: WARNA_STATUS[s] }} />
                  <span className="flex-1">{statusConfig[s].label}</span>
                  <b className="tabular-nums">{ps[s] ?? 0}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Rencana &amp; realisasi per tahun</h2>
            <span className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-[3px] bg-sd-rm/30" /> Rencana
              </span>
              <span className="flex items-center gap-1">
                <i className="h-2.5 w-2.5 rounded-[3px] bg-sd-rm" /> Realisasi
              </span>
            </span>
          </div>
          <div className="flex h-40 items-end gap-3" role="img" aria-label="Rencana dan realisasi per tahun">
            {perTahun.map((x, i) => (
              <div key={x.tahun} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-32 w-full items-end justify-center gap-1">
                  <div
                    className="grafik-tinggi w-1/3 rounded-t bg-sd-rm/30"
                    style={{ height: `${(x.rencana / maksTahun) * 100}%`, animationDelay: `${i * 80}ms` }}
                    title={`Rencana ${x.tahun}: ${formatRupiah(x.rencana)}`}
                  />
                  <div
                    className="grafik-tinggi w-1/3 rounded-t bg-sd-rm"
                    style={{
                      height: `${Math.max(x.realisasi ? 2 : 0, (x.realisasi / maksTahun) * 100)}%`,
                      animationDelay: `${i * 80 + 150}ms`,
                    }}
                    title={`Realisasi ${x.tahun}: ${formatRupiah(x.realisasi)}`}
                  />
                </div>
                <span className={cn("text-xs", x.tahun === tahunIni ? "font-semibold" : "text-muted-foreground")}>{x.tahun}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Proyek terbaru + lokasi */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Proyek terbaru</h2>
            <Link href="/proyek" className="text-xs text-primary-ink underline underline-offset-2">
              Lihat semua →
            </Link>
          </div>
          {(r?.terbaru ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada proyek.</p>
          ) : (
            <ul className="divide-y">
              {r!.terbaru.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link href={`/proyek?id=${p.id}`} className="flex items-center gap-3 py-2.5 hover:bg-accent/40">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.projectName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.balai.shortName ?? p.balai.name} · {p.periode.label}
                      </span>
                    </span>
                    <Badge variant="dot" dotColor={statusConfig[p.status].dotColor}>
                      {statusConfig[p.status].label}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="text-base font-semibold">Sekilas lokasi</h2>
            <span className="text-xs text-muted-foreground">
              {r?.lokasi.length ?? 0} dari {r?.jumlahProyek ?? 0} proyek berlokasi
            </span>
          </div>
          <div className="relative min-h-56 flex-1">
            {r && <PetaMini lokasi={r.lokasi} />}
            {r && r.lokasi.length === 0 && (
              <p className="absolute inset-x-4 top-1/2 z-[500] -translate-y-1/2 rounded-lg bg-card/90 px-3 py-2 text-center text-xs text-muted-foreground shadow-sm">
                Belum ada proyek yang punya titik lokasi. Isi di tab Lokasi Proyek.
              </p>
            )}
          </div>
          <Link href="/proyek" className="inline-flex items-center gap-1 text-sm text-primary-ink underline underline-offset-2">
            Lihat proyek <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
