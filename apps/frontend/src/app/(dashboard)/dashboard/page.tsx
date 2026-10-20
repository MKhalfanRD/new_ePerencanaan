"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  PenLine,
  Wallet,
  MapPin,
  ArrowRight,
  Plus,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { punyaRole } from "@/lib/role";
import { Proyek } from "@/types";
import { statusConfig } from "@/components/shared/status-config";

// --- Formatter angka, konsisten dengan pola di proyekList/page.tsx ---
const formatRupiah = (val: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(val);

const formatRupiahShort = (val: number) => {
  if (val >= 1_000_000_000_000)
    return `Rp${(val / 1_000_000_000_000).toFixed(1)} T`;
  if (val >= 1_000_000_000) return `Rp${(val / 1_000_000_000).toFixed(1)} M`;
  if (val >= 1_000_000) return `Rp${(val / 1_000_000).toFixed(0)} jt`;
  if (val === 0) return "Rp0";
  return `Rp${formatRupiah(val)}`;
};

// Warna tint per status, dipakai utk kotak ikon KPI card — mengikuti token
// dot-badge yang sama dgn status-config.ts (bukan warna baru).
const iconToneClasses: Record<string, string> = {
  slate: "bg-tier-1 text-muted-foreground",
  blue: "bg-primary-soft text-primary-ink",
  amber: "bg-warn/12 text-warn-ink",
  rose: "bg-destructive/10 text-destructive",
  emerald: "bg-ok/10 text-ok",
};

const barToneClasses: Record<string, string> = {
  slate: "bg-st-draft",
  blue: "bg-primary",
  amber: "bg-warn",
  rose: "bg-destructive",
  emerald: "bg-ok",
};

interface BarisAlokasi {
  tahun: number;
  status: "RENCANA" | "REALISASI";
  total: number;
  rm: number;
  rmp: number;
  pln: number;
  sbsn: number;
  kpbu: number;
}

/** Respons GET /proyek/ringkasan (dihitung di backend atas semua proyek). */
interface Ringkasan {
  jumlahProyek: number;
  perStatus: Record<string, number>;
  alokasi: BarisAlokasi[];
  totalLokasi: number;
  terbaru: (Pick<Proyek, "id" | "projectName" | "status"> & {
    balai: { name: string; shortName?: string | null };
    periode: { label: string };
  })[];
  periodeAktif: string | null;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Ringkasan>("/proyek/ringkasan")
      .then((res) => setRingkasan(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const isSatker = punyaRole(user, "SATKER");
  const alokasi = useMemo(() => ringkasan?.alokasi ?? [], [ringkasan]);

  // Tahun yang bisa dipilih di Ringkasan Anggaran — dari data alokasi yang ada.
  const tahunTersedia = useMemo(
    () => [...new Set(alokasi.map((a) => a.tahun))].sort((a, b) => a - b),
    [alokasi],
  );

  // Default "Semua" — sama dengan total di tabel daftar proyek.
  const [tahunAnggaran, setTahunAnggaran] = useState<number | "semua">("semua");

  const periodeAktif = ringkasan?.periodeAktif ?? null;
  const statusCounts: Record<string, number> = {
    DRAFT: 0,
    APPROVED: 0,
    ...ringkasan?.perStatus,
  };
  const totalLokasi = ringkasan?.totalLokasi ?? 0;
  const jumlahProyek = ringkasan?.jumlahProyek ?? 0;

  // Rencana vs realisasi, plus rincian per sumber dana.
  const anggaran = useMemo(() => {
    const dipilih = alokasi.filter(
      (a) => tahunAnggaran === "semua" || a.tahun === tahunAnggaran,
    );
    const rencana = dipilih.filter((a) => a.status === "RENCANA");
    const realisasi = dipilih.filter((a) => a.status === "REALISASI");
    const sum = (list: BarisAlokasi[], key: keyof BarisAlokasi) =>
      list.reduce((s, a) => s + Number(a[key] ?? 0), 0);

    const totalRencana = sum(rencana, "total");
    const totalRealisasi = sum(realisasi, "total");

    // Persentase asli (tidak di-cap) supaya over-budget kelihatan — mis.
    // realisasi 10x rencana = 1000%, bukan disamarkan jadi 100% hijau.
    const persenRealisasi =
      totalRencana > 0 ? Math.round((totalRealisasi / totalRencana) * 100) : 0;

    return {
      totalRencana,
      totalRealisasi,
      persenRealisasi,
      overBudget: totalRealisasi > totalRencana,
      sumberDana: [
        { label: "RM", value: sum(rencana, "rm") },
        { label: "RMP", value: sum(rencana, "rmp") },
        { label: "PLN", value: sum(rencana, "pln") },
        { label: "SBSN", value: sum(rencana, "sbsn") },
        { label: "KPBU", value: sum(rencana, "kpbu") },
      ],
    };
  }, [alokasi, tahunAnggaran]);

  // Rencana anggaran per tahun, utk bar chart flat sederhana (CSS murni,
  // tanpa dependency chart baru).
  const perTahun = useMemo(() => {
    const rows = alokasi
      .filter((a) => a.status === "RENCANA")
      .map(({ tahun, total }) => ({ tahun, total }));
    const max = Math.max(1, ...rows.map((r) => r.total));
    return { rows, max };
  }, [alokasi]);

  const recentProyek = ringkasan?.terbaru ?? [];

  const kpiCards = [
    {
      key: "total",
      title: "Total Proyek",
      value: jumlahProyek,
      icon: FileText,
      tone: "blue",
    },
    {
      key: "draft",
      title: statusConfig.DRAFT.label,
      value: statusCounts.DRAFT,
      icon: PenLine,
      tone: statusConfig.DRAFT.dotColor,
    },
    {
      key: "approved",
      title: statusConfig.APPROVED.label,
      value: statusCounts.APPROVED,
      icon: CheckCircle2,
      tone: statusConfig.APPROVED.dotColor,
    },
  ] as const;

  const statusRows = (
    Object.keys(statusConfig) as (keyof typeof statusConfig)[]
  ).map((key) => ({
    key,
    ...statusConfig[key],
    count: statusCounts[key] ?? 0,
  }));
  const statusTotal = Math.max(1, jumlahProyek);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selamat datang,{" "}
            <span className="font-medium text-foreground">{user?.name}</span>
            {periodeAktif && (
              <>
                {" "}
                · Periode aktif{" "}
                <span className="font-medium text-foreground">
                  {periodeAktif}
                </span>
              </>
            )}
          </p>
        </div>
        {isSatker && (
          <Button asChild size="sm" className="gap-1.5 self-start sm:self-auto">
            <Link href="/proyek">
              <Plus size={15} />
              Proyek Baru
            </Link>
          </Button>
        )}
      </div>

      {/* KPI cards — aksen kiri tipis per warna status, bukan blok warna penuh */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card) => (
          <Card key={card.key} className="border-l-4 border-l-transparent">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold mt-1 text-foreground">
                    {loading ? "—" : card.value}
                  </p>
                </div>
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    iconToneClasses[card.tone]
                  }`}
                >
                  <card.icon size={18} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ringkasan anggaran — rencana vs realisasi + sumber dana, grid 5 kolom
            flat sesuai pola alokasi-expand-panel.tsx */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet size={16} className="text-primary-ink" />
              Ringkasan Rencana Anggaran
            </CardTitle>
            {tahunTersedia.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2">
                {["semua" as const, ...tahunTersedia].map((th) => {
                  const aktif = tahunAnggaran === th;
                  return (
                    <button
                      key={th}
                      type="button"
                      onClick={() => setTahunAnggaran(th)}
                      className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                        aktif
                          ? "bg-primary text-white"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {th === "semua"
                        ? "Semua tahun"
                        : th === new Date().getFullYear()
                          ? `${th} (berjalan)`
                          : th}
                    </button>
                  );
                })}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Rencana
                </p>
                <p className="text-xl font-bold mt-1 text-foreground">
                  {loading ? "—" : formatRupiahShort(anggaran.totalRencana)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Realisasi
                </p>
                <p
                  className={`text-xl font-bold mt-1 ${
                    anggaran.overBudget ? "text-warn-ink" : "text-ok"
                  }`}
                >
                  {loading ? "—" : formatRupiahShort(anggaran.totalRealisasi)}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-muted-foreground font-medium">
                  Realisasi terhadap rencana
                </p>
                <p
                  className={`text-xs font-semibold ${
                    anggaran.overBudget ? "text-warn-ink" : "text-foreground"
                  }`}
                >
                  {loading
                    ? "—"
                    : `${anggaran.persenRealisasi}%${
                        anggaran.overBudget ? " · melebihi rencana" : ""
                      }`}
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-tier-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    anggaran.overBudget ? "bg-warn" : "bg-ok"
                  }`}
                  style={{
                    width: `${
                      loading ? 0 : Math.min(100, anggaran.persenRealisasi)
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Rencana per Sumber Dana
              </p>
              <div className="grid grid-cols-5 gap-2">
                {anggaran.sumberDana.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-md border bg-tier-2/60 px-2 py-2 text-center"
                  >
                    <p className="text-[10px] font-semibold text-muted-foreground">
                      {s.label}
                    </p>
                    <p className="text-xs font-semibold mt-0.5 text-foreground">
                      {loading ? "—" : formatRupiahShort(s.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Distribusi status — badge dot + bar tipis, bukan pie berat */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribusi Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusRows.map((row) => (
              <div key={row.key}>
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="dot" dotColor={row.dotColor}>
                    {row.label}
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">
                    {loading ? "—" : row.count}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-tier-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barToneClasses[row.dotColor]}`}
                    style={{
                      width: `${loading ? 0 : (row.count / statusTotal) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Rencana anggaran per tahun — bar chart flat murni CSS */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Rencana Anggaran per Tahun
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-40 rounded-lg bg-muted animate-pulse" />
            ) : perTahun.rows.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Belum ada data alokasi rencana
              </div>
            ) : (
              <div className="flex items-end gap-3 h-40">
                {perTahun.rows.map((r) => (
                  <div
                    key={r.tahun}
                    className="flex-1 flex flex-col items-center justify-end h-full group"
                  >
                    <p className="text-[11px] font-semibold text-foreground mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatRupiahShort(r.total)}
                    </p>
                    <div
                      className="w-full max-w-10 rounded-t-md bg-primary/80 group-hover:bg-primary transition-colors"
                      style={{
                        height: `${Math.max(4, (r.total / perTahun.max) * 100)}%`,
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-2 font-medium">
                      {r.tahun}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistik ringan lain: jumlah lokasi & tautan cepat */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sekilas Lokasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="w-9 h-9 rounded-lg bg-primary-soft text-primary-ink flex items-center justify-center shrink-0">
                <MapPin size={18} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Total Titik Lokasi
                </p>
                <p className="text-xl font-bold text-foreground">
                  {loading ? "—" : totalLokasi}
                </p>
              </div>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full justify-between"
            >
              <Link href="/proyek">
                Lihat semua proyek
                <ArrowRight size={14} />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Proyek terbaru */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Proyek Terbaru</CardTitle>
          <Link
            href="/proyek"
            className="text-xs font-medium text-primary-ink hover:underline flex items-center gap-1"
          >
            Lihat semua
            <ArrowRight size={12} />
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-muted rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : recentProyek.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Belum ada proyek</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentProyek.map((p) => {
                const cfg = statusConfig[p.status];
                return (
                  <Link
                    key={p.id}
                    href="/proyek"
                    className="flex items-center justify-between py-3 px-1 -mx-1 rounded-lg hover:bg-tier-2 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate text-foreground">
                        {p.projectName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.balai.shortName ?? p.balai.name} · {p.periode.label}
                      </p>
                    </div>
                    <Badge
                      variant="dot"
                      dotColor={cfg.dotColor}
                      className="ml-3 shrink-0"
                    >
                      {cfg.label}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
