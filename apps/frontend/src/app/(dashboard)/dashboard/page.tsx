"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Clock,
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
import { Planning, PaginatedResponse } from "@/types";
import { statusConfig } from "@/components/shared/status-config";

// --- Formatter angka, konsisten dengan pola di plannings/page.tsx ---
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
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  emerald: "bg-emerald-50 text-emerald-600",
};

const barToneClasses: Record<string, string> = {
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  emerald: "bg-emerald-500",
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<PaginatedResponse<Planning>>("/plannings?limit=100")
      .then((res) => setPlannings(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const isSatker = user?.role === "SATKER";
  const isReviewer =
    user?.role === "VERIFICATOR" || user?.role === "ADMINISTRATOR";

  // Periode aktif diturunkan dari data yang sudah ada (tidak nambah request) —
  // setiap Planning bawa objek `periode` lengkap dgn flag isActive.
  const periodeAktif = useMemo(() => {
    const found = plannings.find((p) => p.periode?.isActive);
    return found?.periode.label ?? null;
  }, [plannings]);

  const statusCounts = useMemo(() => {
    const base: Record<string, number> = {
      DRAFT: 0,
      SUBMITTED: 0,
      REVISION: 0,
      REJECTED: 0,
      APPROVED: 0,
    };
    for (const p of plannings) base[p.status] = (base[p.status] ?? 0) + 1;
    return base;
  }, [plannings]);

  const totalLokasi = useMemo(
    () =>
      plannings.reduce(
        (acc, p) => acc + p.alokasi.reduce((s, a) => s + a.lokasi.length, 0),
        0,
      ),
    [plannings],
  );

  // Rencana vs realisasi, plus rincian per sumber dana — meniru grid 5-kolom
  // flat yang sudah dipakai di alokasi-expand-panel.tsx supaya konsisten.
  const anggaran = useMemo(() => {
    const semuaAlokasi = plannings.flatMap((p) => p.alokasi);
    const rencana = semuaAlokasi.filter((a) => a.status === "RENCANA");
    const realisasi = semuaAlokasi.filter((a) => a.status === "REALISASI");
    const sum = (
      list: typeof semuaAlokasi,
      key: keyof (typeof semuaAlokasi)[number],
    ) => list.reduce((s, a) => s + Number(a[key] ?? 0), 0);

    const totalRencana = sum(rencana, "total");
    const totalRealisasi = sum(realisasi, "total");

    return {
      totalRencana,
      totalRealisasi,
      persenRealisasi:
        totalRencana > 0
          ? Math.min(100, Math.round((totalRealisasi / totalRencana) * 100))
          : 0,
      sumberDana: [
        { label: "RM", value: sum(rencana, "rm") },
        { label: "RMP", value: sum(rencana, "rmp") },
        { label: "PLN", value: sum(rencana, "pln") },
        { label: "SBSN", value: sum(rencana, "sbsn") },
        { label: "KPBU", value: sum(rencana, "kpbu") },
      ],
    };
  }, [plannings]);

  // Rencana anggaran per tahun, utk bar chart flat sederhana (CSS murni,
  // tanpa dependency chart baru).
  const perTahun = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of plannings) {
      for (const a of p.alokasi) {
        if (a.status !== "RENCANA") continue;
        map.set(a.tahun, (map.get(a.tahun) ?? 0) + Number(a.total));
      }
    }
    const rows = Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([tahun, total]) => ({ tahun, total }));
    const max = Math.max(1, ...rows.map((r) => r.total));
    return { rows, max };
  }, [plannings]);

  const recentPlannings = useMemo(
    () =>
      [...plannings]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 6),
    [plannings],
  );

  const kpiCards = [
    {
      key: "total",
      title: "Total Planning",
      value: plannings.length,
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
      key: "submitted",
      title: statusConfig.SUBMITTED.label,
      value: statusCounts.SUBMITTED,
      icon: Clock,
      tone: statusConfig.SUBMITTED.dotColor,
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
  const statusTotal = Math.max(1, plannings.length);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
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
            <Link href="/plannings">
              <Plus size={15} />
              Planning Baru
            </Link>
          </Button>
        )}
      </div>

      {/* KPI cards — aksen kiri tipis per warna status, bukan blok warna penuh */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <Card key={card.key} className="border-l-4 border-l-transparent">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold mt-1 text-slate-900">
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
              <Wallet size={16} className="text-blue-600" />
              Ringkasan Rencana Anggaran
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Total Rencana
                </p>
                <p className="text-xl font-bold mt-1 text-slate-900">
                  {loading ? "—" : formatRupiahShort(anggaran.totalRencana)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Total Realisasi
                </p>
                <p className="text-xl font-bold mt-1 text-emerald-700">
                  {loading ? "—" : formatRupiahShort(anggaran.totalRealisasi)}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-muted-foreground font-medium">
                  Progres realisasi thd rencana
                </p>
                <p className="text-xs font-semibold text-slate-900">
                  {loading ? "—" : `${anggaran.persenRealisasi}%`}
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${loading ? 0 : anggaran.persenRealisasi}%`,
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
                    className="rounded-md border bg-slate-50/60 px-2 py-2 text-center"
                  >
                    <p className="text-[10px] font-semibold text-muted-foreground">
                      {s.label}
                    </p>
                    <p className="text-xs font-semibold mt-0.5 text-slate-900">
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
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
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
                    <p className="text-[11px] font-semibold text-slate-700 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatRupiahShort(r.total)}
                    </p>
                    <div
                      className="w-full max-w-10 rounded-t-md bg-blue-500/80 group-hover:bg-blue-600 transition-colors"
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
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <MapPin size={18} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Total Titik Lokasi
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {loading ? "—" : totalLokasi}
                </p>
              </div>
            </div>
            {isReviewer && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full justify-between"
              >
                <Link href="/review">
                  Buka antrean review
                  <ArrowRight size={14} />
                </Link>
              </Button>
            )}
            {!isReviewer && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full justify-between"
              >
                <Link href="/plannings">
                  Lihat semua planning
                  <ArrowRight size={14} />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Planning terbaru */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Planning Terbaru</CardTitle>
          <Link
            href="/plannings"
            className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1"
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
          ) : recentPlannings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Belum ada planning</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentPlannings.map((p) => {
                const cfg = statusConfig[p.status];
                return (
                  <Link
                    key={p.id}
                    href="/plannings"
                    className="flex items-center justify-between py-3 px-1 -mx-1 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate text-slate-900">
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
