"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusConfig } from "@/components/shared/status-config";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatRupiahShort } from "@/lib/format-rupiah";
import { type DataLaporan, type KolomLaporan, unduhExcel, unduhPdf } from "@/lib/export-laporan";
import { useAuthStore } from "@/store/auth";
import type { Periode } from "@/types";

type Jenis = "alokasi" | "proyek" | "saldo";
const JENIS: [Jenis, string, string][] = [
  ["alokasi", "Alokasi rencana & realisasi per kegiatan", "Per sumber dana, per tahun"],
  ["proyek", "Total proyek per kegiatan", "Jumlah proyek & paket, per status, per balai"],
  ["saldo", "Saldo & pemakaian per balai", "Saldo kegiatan, terpakai per balai, sisa"],
];
const SEMUA = "__semua";

/** Angka ringkas di layar (angka penuh di file). */
const ringkas = (v: number | null | undefined, jenis: KolomLaporan["jenis"]) => {
  if (v == null) return "–";
  if (jenis === "pct") return `${Math.round(v)}%`;
  if (jenis === "rp") return v === 0 ? "–" : formatRupiahShort(v).replace(/^Rp\s?/, "");
  return v.toLocaleString("id-ID");
};

/** Menu Laporan (hi-fi HfLaporan, flowchart-laporan.pdf). */
export default function LaporanPage() {
  const { user } = useAuthStore();
  const [jenis, setJenis] = useState<Jenis>("alokasi");
  const [tahunList, setTahunList] = useState<number[]>([]);
  const [tahun, setTahun] = useState<string>(String(new Date().getFullYear()));
  const [kegiatanId, setKegiatanId] = useState("");
  const [balaiId, setBalaiId] = useState("");
  const [status, setStatus] = useState("");
  const [opsiKegiatan, setOpsiKegiatan] = useState<{ id: string; name: string }[]>([]);
  const [opsiBalai, setOpsiBalai] = useState<{ id: number; name: string }[]>([]);
  const [data, setData] = useState<DataLaporan | null>(null);
  const [memuat, setMemuat] = useState(false);

  useEffect(() => {
    api
      .get<Periode[]>("/master/periodes")
      .then((r) => {
        const p = r.data.find((x) => x.isActive) ?? r.data[0];
        if (p) setTahunList(Array.from({ length: p.endYear - p.startYear + 1 }, (_, i) => p.startYear + i));
      })
      .catch(() => {});
    api.get("/master/kegiatan").then((r) => setOpsiKegiatan(r.data)).catch(() => {});
    api.get("/master/balai").then((r) => setOpsiBalai(r.data)).catch(() => {});
  }, []);

  // Laporan saldo selalu per 1 tahun.
  const tahunEfektif = jenis === "saldo" && tahun === SEMUA ? String(new Date().getFullYear()) : tahun;
  useEffect(() => {
    setMemuat(true);
    api
      .get<DataLaporan>(`/laporan/${jenis}`, {
        params: {
          tahun: tahunEfektif === SEMUA ? undefined : tahunEfektif,
          kegiatanId: kegiatanId || undefined,
          balaiId: balaiId || undefined,
          status: status || undefined,
        },
      })
      .then((r) => setData(r.data))
      .catch((err) => {
        setData(null);
        toast.error(err.response?.data?.message || "Gagal memuat laporan");
      })
      .finally(() => setMemuat(false));
  }, [jenis, tahunEfektif, kegiatanId, balaiId, status]);

  const saringan = useMemo<[string, string][]>(
    () => [
      ["Tahun", tahunEfektif === SEMUA ? "Semua tahun" : tahunEfektif],
      ["Kegiatan", kegiatanId ? `${kegiatanId} · ${opsiKegiatan.find((k) => k.id === kegiatanId)?.name ?? ""}` : "Semua kegiatan"],
      ["Balai", balaiId ? (opsiBalai.find((b) => String(b.id) === balaiId)?.name ?? balaiId) : "Semua balai"],
      ["Status proyek", status ? statusConfig[status as keyof typeof statusConfig].label : "Semua status"],
    ],
    [tahunEfektif, kegiatanId, balaiId, status, opsiKegiatan, opsiBalai],
  );
  const pencetak = user?.name ?? "-";
  const kosong = !!data && data.baris.length === 0;

  const pilih = (label: string, id: string, value: string, set: (v: string) => void, opsi: [string, string][], semua?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || SEMUA} onValueChange={(v) => set(v === SEMUA ? "" : v)}>
        <SelectTrigger id={id} className="h-10 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {semua && <SelectItem value={SEMUA}>{semua}</SelectItem>}
          {opsi.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laporan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pilih jenis laporan, saring, lalu unduh</p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Jenis laporan" className="space-y-1 rounded-xl border bg-card p-2">
            {JENIS.map(([k, judul, ket]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={jenis === k}
                onClick={() => setJenis(k)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  jenis === k ? "bg-primary-soft" : "hover:bg-accent",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2",
                    jenis === k ? "border-primary" : "border-input",
                  )}
                >
                  {jenis === k && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{judul}</span>
                  <span className="block text-xs text-muted-foreground">{ket}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-3 rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold">Saring</p>
            {pilih(
              "Tahun",
              "lap-tahun",
              tahun === SEMUA ? "" : tahun,
              (v) => setTahun(v || SEMUA),
              tahunList.map((t) => [String(t), String(t)]),
              jenis === "saldo" ? undefined : "Semua tahun",
            )}
            {pilih("Kegiatan", "lap-kegiatan", kegiatanId, setKegiatanId, opsiKegiatan.map((k) => [k.id, `${k.id} · ${k.name}`]), "Semua kegiatan")}
            {pilih("Balai", "lap-balai", balaiId, setBalaiId, opsiBalai.map((b) => [String(b.id), b.name]), "Semua balai")}
            {pilih(
              "Status proyek",
              "lap-status",
              status,
              setStatus,
              Object.entries(statusConfig).map(([k, v]) => [k, v.label]),
              "Semua status",
            )}
            {jenis === "saldo" && <p className="text-xs text-muted-foreground">Saldo ditetapkan per tahun, jadi laporan ini selalu satu tahun.</p>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button className="h-10" disabled={!data || kosong || memuat} onClick={() => data && unduhPdf(data, saringan, pencetak)}>
              <Download size={15} className="mr-1.5" /> Unduh PDF
            </Button>
            <Button
              variant="outline"
              className="h-10"
              disabled={!data || kosong || memuat}
              onClick={() => data && unduhExcel(data, saringan, pencetak)}
            >
              <Download size={15} className="mr-1.5" /> Unduh Excel
            </Button>
          </div>
        </div>

        {/* Pratinjau */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-start justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">
                {data?.judul ?? JENIS.find((j) => j[0] === jenis)![1]}
                {jenis !== "saldo" && tahunEfektif !== SEMUA && ` · ${tahunEfektif}`}
              </h2>
              <p className="text-xs text-muted-foreground">Pratinjau sama dengan isi file; di file angka ditulis penuh</p>
            </div>
            {memuat && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
          </div>
          {kosong ? (
            <p className="border-t px-5 py-10 text-center text-sm text-muted-foreground">
              Tidak ada data untuk saringan ini. Ubah tahun, kegiatan, balai, atau status.
            </p>
          ) : data ? (
            <div className="overflow-x-auto border-t">
              <table className="w-full min-w-[40rem] text-[13px]">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold">Uraian</th>
                    {data.kolom.map((k) => (
                      <th key={k.key} className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                        {k.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.baris.map((b, i) => (
                    <tr key={i} className={cn("border-b", !b.rincian && "bg-tier-2")}>
                      <td className={cn("max-w-[16rem] truncate px-4 py-2", b.rincian ? "pl-8 text-muted-foreground" : "font-medium")} title={b.label}>
                        {b.label}
                      </td>
                      {data.kolom.map((k) => (
                        <td key={k.key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                          {ringkas(b.nilai[k.key], k.jenis)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {data.total.map((b, i) => (
                    <tr key={`t${i}`} className="border-b font-semibold last:border-b-0">
                      <td className="px-4 py-2.5">{b.label}</td>
                      {data.kolom.map((k) => (
                        <td key={k.key} className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                          {ringkas(b.nilai[k.key], k.jenis)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-2 border-t p-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-muted" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
