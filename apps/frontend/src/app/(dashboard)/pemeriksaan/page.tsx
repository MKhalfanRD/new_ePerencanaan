"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaldoKegiatan } from "@/components/anggaran/saldo-kegiatan";
import { statusConfig } from "@/components/shared/status-config";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatRupiah, formatRupiahShort } from "@/lib/format-rupiah";
import {
  LABEL_AKSI,
  adalahAdmin,
  type JejakPemeriksaan,
  waktuSingkat,
} from "@/lib/alur-status";
import { useAuthStore } from "@/store/auth";
import type { Proyek } from "@/types";

type Tab = "perlu" | "keputusan" | "selesai";
interface Baris {
  id: string;
  kodeProyek: string | null;
  projectName: string;
  status: Proyek["status"];
  kegiatanId: string | null;
  skorEvaluasi: number | null;
  balai: { id: number; name: string };
  totalRencana: number;
  diajukanPada: string | null;
  diajukanUlang: boolean;
  jejak: JejakPemeriksaan[];
}

const SEMUA = "__semua";
const TAB: [Tab, string][] = [
  ["perlu", "Perlu diperiksa"],
  ["keputusan", "Menunggu keputusan"],
  ["selesai", "Selesai"],
];
const hariMenunggu = (iso: string | null) => {
  if (!iso) return "—";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return h <= 0 ? "hari ini" : `${h} hari`;
};

/** Menu Pemeriksaan (hi-fi HfPeriksa / HfPeriksaAdmin, flowchart-alur-status.pdf). */
export default function PemeriksaanPage() {
  const { user } = useAuthStore();
  const admin = adalahAdmin(user);
  const [tab, setTab] = useState<Tab>(admin ? "keputusan" : "perlu");
  const [kegiatanId, setKegiatanId] = useState("");
  const [balaiId, setBalaiId] = useState("");
  const [data, setData] = useState<Baris[] | null>(null);
  const [jumlah, setJumlah] = useState<Record<Tab, number>>({ perlu: 0, keputusan: 0, selesai: 0 });
  const [pilihId, setPilihId] = useState<string | null>(null);
  const [centang, setCentang] = useState<Set<string>>(new Set());
  const [opsiKegiatan, setOpsiKegiatan] = useState<{ id: string; name: string }[]>([]);
  const [opsiBalai, setOpsiBalai] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    api
      .get("/master/kegiatan")
      .then((r) => setOpsiKegiatan(r.data))
      .catch(() => {});
    api
      .get("/master/balai")
      .then((r) => setOpsiBalai(r.data))
      .catch(() => {});
  }, []);

  const muat = useCallback(() => {
    setData(null);
    api
      .get<{ jumlah: Record<Tab, number>; data: Baris[] }>("/proyek/pemeriksaan", {
        params: { tab, kegiatanId: kegiatanId || undefined, balaiId: balaiId || undefined },
      })
      .then((r) => {
        setData(r.data.data);
        setJumlah(r.data.jumlah);
        setCentang(new Set());
        setPilihId((cur) => (r.data.data.some((d) => d.id === cur) ? cur : (r.data.data[0]?.id ?? null)));
      })
      .catch((err) => {
        setData([]);
        toast.error(err.response?.data?.message || "Gagal memuat daftar pemeriksaan");
      });
  }, [tab, kegiatanId, balaiId]);
  useEffect(muat, [muat]);

  const dipilih = data?.find((d) => d.id === pilihId) ?? null;
  const bisaMassal = admin && tab !== "selesai";
  const semuaDicentang = !!data?.length && centang.size === data.length;
  const [massal, setMassal] = useState(false);
  const setujuiMassal = async () => {
    setMassal(true);
    try {
      const r = await api.post<{ berhasil: number; gagal: { id: string; alasan: string }[] }>(
        "/proyek/setujui-massal",
        { ids: [...centang] },
      );
      if (r.data.berhasil) toast.success(`${r.data.berhasil} proyek disetujui`);
      if (r.data.gagal.length) toast.error(`${r.data.gagal.length} gagal: ${r.data.gagal[0].alasan}`);
      muat();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyetujui");
    } finally {
      setMassal(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pemeriksaan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {admin
              ? "Keputusan akhir: Admin / Super Admin · urut paling lama menunggu"
              : "Proyek yang diajukan di cakupan Anda · urut paling lama menunggu"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {admin && (
            <Select value={kegiatanId || SEMUA} onValueChange={(v) => setKegiatanId(v === SEMUA ? "" : v)}>
              <SelectTrigger aria-label="Kegiatan" className="h-9 w-52 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEMUA}>Semua kegiatan</SelectItem>
                {opsiKegiatan.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.id} · {k.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={balaiId || SEMUA} onValueChange={(v) => setBalaiId(v === SEMUA ? "" : v)}>
            <SelectTrigger aria-label="Balai" className="h-9 w-52 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua balai</SelectItem>
              {opsiBalai.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <nav aria-label="Tahap pemeriksaan" className="flex gap-1 overflow-x-auto border-b">
        {TAB.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-current={tab === k ? "page" : undefined}
            onClick={() => setTab(k)}
            className={cn(
              "-mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 px-2.5 text-[14.5px] transition-colors",
              tab === k
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span className="rounded-full bg-tier-1 px-2 text-xs tabular-nums text-muted-foreground">{jumlah[k]}</span>
          </button>
        ))}
      </nav>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Daftar */}
        <div className="overflow-hidden rounded-xl border bg-card">
          {bisaMassal && centang.size > 0 && (
            <div className="flex items-center gap-3 border-b bg-primary-soft px-4 py-2 text-sm">
              <span className="flex-1">{centang.size} proyek dipilih</span>
              <Button size="sm" onClick={setujuiMassal} disabled={massal}>
                {massal ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <CheckCheck size={13} className="mr-1.5" />}
                Setujui terpilih
              </Button>
            </div>
          )}
          <div
            className={cn(
              "grid items-center gap-3 border-b px-4 py-2.5 text-[13px] font-semibold text-muted-foreground",
              bisaMassal ? "grid-cols-[1.25rem_minmax(0,2fr)_6rem_7rem]" : "grid-cols-[minmax(0,2fr)_6rem_7rem]",
            )}
          >
            {bisaMassal && (
              <input
                type="checkbox"
                aria-label="Pilih semua"
                className="h-4 w-4"
                checked={semuaDicentang}
                onChange={() => setCentang(semuaDicentang ? new Set() : new Set(data?.map((d) => d.id)))}
              />
            )}
            <span>Proyek</span>
            <span className="text-right">Total</span>
            <span>{tab === "perlu" ? "Menunggu" : tab === "keputusan" ? "Hasil pemeriksa" : "Status"}</span>
          </div>
          {!data &&
            [0, 1, 2].map((i) => (
              <div key={i} className="border-b px-4 py-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              </div>
            ))}
          {data?.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              {tab === "perlu"
                ? "Tidak ada proyek yang menunggu diperiksa."
                : tab === "keputusan"
                  ? "Tidak ada proyek yang menunggu keputusan."
                  : "Belum ada proyek yang selesai diperiksa."}
            </p>
          )}
          {data?.map((d) => {
            const hasil = d.jejak.find((j) => j.aksi === "SESUAI");
            return (
              <div
                key={d.id}
                role="button"
                tabIndex={0}
                aria-pressed={pilihId === d.id}
                onClick={() => setPilihId(d.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPilihId(d.id);
                  }
                }}
                className={cn(
                  "grid cursor-pointer items-center gap-3 border-b px-4 py-3 text-sm outline-none last:border-b-0 hover:bg-accent/50 focus-visible:bg-accent",
                  bisaMassal ? "grid-cols-[1.25rem_minmax(0,2fr)_6rem_7rem]" : "grid-cols-[minmax(0,2fr)_6rem_7rem]",
                  pilihId === d.id && "bg-primary-soft hover:bg-primary-soft",
                )}
              >
                {bisaMassal && (
                  <input
                    type="checkbox"
                    aria-label={`Pilih ${d.projectName}`}
                    className="h-4 w-4"
                    checked={centang.has(d.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() =>
                      setCentang((cur) => {
                        const n = new Set(cur);
                        if (n.has(d.id)) n.delete(d.id);
                        else n.add(d.id);
                        return n;
                      })
                    }
                  />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{d.projectName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="font-mono">{d.kodeProyek}</span> · {d.balai.name}
                    {d.diajukanUlang && " · diajukan ulang"}
                  </span>
                </span>
                <span className="text-right tabular-nums" title={formatRupiah(d.totalRencana)}>
                  {formatRupiahShort(d.totalRencana)}
                </span>
                <span className="text-[13px]">
                  {tab === "perlu" ? (
                    hariMenunggu(d.diajukanPada)
                  ) : tab === "keputusan" ? (
                    hasil ? (
                      <>
                        <b className="text-ok">Sesuai</b>
                        <span className="text-muted-foreground"> · {hasil.user.name}</span>
                      </>
                    ) : (
                      "—"
                    )
                  ) : (
                    <Badge variant="dot" dotColor={statusConfig[d.status].dotColor}>
                      {statusConfig[d.status].label}
                    </Badge>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Panel proyek terpilih */}
        {dipilih ? (
          <PanelProyek key={dipilih.id} d={dipilih} tab={tab} admin={admin} onSelesai={muat} />
        ) : (
          data &&
          data.length > 0 && (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Pilih proyek di kiri untuk memeriksa.
            </p>
          )
        )}
      </div>
    </div>
  );
}

function PanelProyek({ d, tab, admin, onSelesai }: { d: Baris; tab: Tab; admin: boolean; onSelesai: () => void }) {
  const tahun = new Date().getFullYear();
  const saldo = useSaldoKegiatan(d.kegiatanId, tahun, tahun);
  const s = saldo?.[0];
  const [hasil, setHasil] = useState<"SESUAI" | "REVISI">("SESUAI");
  const [catatan, setCatatan] = useState("");
  const [kirim, setKirim] = useState(false);
  const pengembalian = useMemo(() => d.jejak.find((j) => j.aksi === "REVISI" || j.aksi === "KEMBALIKAN"), [d.jejak]);
  // Proyek yang diajukan ulang: apa saja yang berubah sejak dikembalikan (dari riwayat proyek).
  const [berubah, setBerubah] = useState<
    { key: string; kolom: string; sebelum: string | null; sesudah: string | null }[] | null
  >(null);
  useEffect(() => {
    if (!d.diajukanUlang || tab === "selesai") return;
    api
      .get(`/proyek/${d.id}/perubahan`)
      .then((r) => setBerubah(r.data.perubahan))
      .catch(() => setBerubah([]));
  }, [d.id, d.diajukanUlang, tab]);
  const sesuai = d.jejak.find((j) => j.aksi === "SESUAI");

  const aksi = async (url: string, body: object, pesan: string) => {
    setKirim(true);
    try {
      await api.patch(`/proyek/${d.id}/${url}`, body);
      toast.success(pesan);
      onSelesai();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memproses proyek");
    } finally {
      setKirim(false);
    }
  };
  const catatanKurang = catatan.trim().length < 3;
  // Pemeriksa: tab Perlu diperiksa. Admin: Perlu diperiksa & Menunggu keputusan.
  const formPemeriksa = !admin && tab === "perlu";
  const formAdmin = admin && tab !== "selesai";

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 lg:sticky lg:top-4">
      <div>
        <h2 className="text-base font-semibold">{d.projectName}</h2>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">{d.kodeProyek}</span> · {d.balai.name}
          {d.kegiatanId && ` · kegiatan ${d.kegiatanId}`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Total rencana</p>
          <p className="text-lg font-bold tabular-nums">{formatRupiahShort(d.totalRencana)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Skor evaluasi</p>
          <p className="text-lg font-bold tabular-nums">
            {d.skorEvaluasi == null ? "—" : (d.skorEvaluasi * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}
            <span className="text-sm font-normal text-muted-foreground"> / 100</span>
          </p>
        </div>
      </div>
      {d.kegiatanId && saldo && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">
              Saldo kegiatan {d.kegiatanId} · {tahun}
            </span>
            {s?.saldo ? (
              <span>
                sisa <b>{formatRupiahShort(s.saldo.total - s.terpakai.total)}</b> dari {formatRupiahShort(s.saldo.total)}
              </span>
            ) : (
              <span className="text-muted-foreground">belum ditetapkan</span>
            )}
          </div>
          {s?.saldo && (
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full",
                  s.terpakai.total > s.saldo.total ? "bg-destructive" : "bg-primary",
                )}
                style={{ width: `${Math.min(100, (s.terpakai.total / s.saldo.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {sesuai && (tab === "keputusan" || tab === "selesai") && (
        <div className="flex gap-2.5 rounded-lg bg-ok/10 px-3.5 py-3 text-[13px]">
          <Check size={15} className="mt-0.5 shrink-0 text-ok" />
          <p>
            <b>Sesuai</b> · {sesuai.user.name}
            {sesuai.user.role?.name ? ` (${sesuai.user.role.name})` : ""}, {waktuSingkat(sesuai.createdAt)}
            {sesuai.catatan && <span className="block">&ldquo;{sesuai.catatan}&rdquo;</span>}
          </p>
        </div>
      )}
      {pengembalian && (
        <div className="flex gap-2.5 rounded-lg bg-destructive/10 px-3.5 py-3 text-[13px]">
          <RotateCcw size={15} className="mt-0.5 shrink-0 text-destructive" />
          <p>
            <b>Dikembalikan sebelumnya</b> · {pengembalian.user.name}, {waktuSingkat(pengembalian.createdAt)}
            {pengembalian.catatan && <span className="block">&ldquo;{pengembalian.catatan}&rdquo;</span>}
          </p>
        </div>
      )}

      {berubah && (
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 bg-tier-1 px-3.5 py-2 text-xs font-semibold text-muted-foreground">
            <span>Yang berubah sejak dikembalikan</span>
            <span className="text-right">Sebelum</span>
            <span className="text-right">Diajukan ulang</span>
          </div>
          {berubah.length === 0 ? (
            <p className="px-3.5 py-3 text-[13px] text-muted-foreground">
              Tidak ada perubahan isi sejak dikembalikan.
            </p>
          ) : (
            berubah.map((p) => (
              <div
                key={p.key}
                className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-t px-3.5 py-2 text-[13px]"
              >
                <span className="break-words text-muted-foreground">{p.kolom}</span>
                <span className="break-words text-right">{p.sebelum ?? "–"}</span>
                <b className="break-words text-right">{p.sesudah ?? "–"}</b>
              </div>
            ))
          )}
        </div>
      )}

      {formPemeriksa && (
        <div className="space-y-2.5">
          <p className="text-[13px] font-medium">Hasil pemeriksaan Anda</p>
          <div role="radiogroup" aria-label="Hasil pemeriksaan" className="inline-flex overflow-hidden rounded-lg border">
            {(
              [
                ["SESUAI", "Sesuai"],
                ["REVISI", "Perlu revisi"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={hasil === k}
                onClick={() => setHasil(k)}
                className={cn(
                  "flex h-9 items-center gap-1.5 px-3.5 text-sm",
                  hasil === k ? "bg-foreground text-background" : "hover:bg-accent",
                )}
              >
                {hasil === k && <Check size={13} />}
                {label}
              </button>
            ))}
          </div>
          <Textarea
            aria-label="Catatan pemeriksaan"
            rows={3}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder={hasil === "REVISI" ? "Catatan wajib: apa yang perlu diperbaiki…" : "Catatan (opsional)…"}
          />
          <div className="flex justify-end">
            <Button
              disabled={kirim || (hasil === "REVISI" && catatanKurang)}
              onClick={() =>
                aksi(
                  "periksa",
                  { hasil, catatan },
                  hasil === "REVISI" ? "Proyek dikembalikan untuk revisi" : "Hasil pemeriksaan dikirim",
                )
              }
            >
              {kirim && <Loader2 size={14} className="mr-2 animate-spin" />}
              Kirim hasil
            </Button>
          </div>
        </div>
      )}

      {formAdmin && (
        <div className="space-y-2.5">
          <Label htmlFor="catatan-keputusan">Catatan keputusan</Label>
          <Textarea
            id="catatan-keputusan"
            rows={3}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Wajib diisi bila dikembalikan…"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={kirim || catatanKurang}
              title={catatanKurang ? "Isi catatan dulu untuk mengembalikan" : undefined}
              onClick={() => aksi("putuskan", { hasil: "KEMBALIKAN", catatan }, "Proyek dikembalikan untuk revisi")}
            >
              <RotateCcw size={14} className="mr-1.5" /> Kembalikan
            </Button>
            <Button
              disabled={kirim}
              onClick={() => aksi("putuskan", { hasil: "SETUJU", catatan }, "Proyek disetujui")}
            >
              {kirim ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Check size={14} className="mr-1.5" />}
              Setujui
            </Button>
          </div>
        </div>
      )}

      {tab === "selesai" && d.jejak.length > 0 && (
        <ul className="space-y-1.5 border-t pt-3 text-[13px]">
          {d.jejak.map((j, i) => (
            <li key={i} className="text-muted-foreground">
              <b className="text-foreground">{LABEL_AKSI[j.aksi]}</b> · {j.user.name}, {waktuSingkat(j.createdAt)}
              {j.catatan && ` — "${j.catatan}"`}
            </li>
          ))}
        </ul>
      )}

      <Link href={`/proyek?id=${d.id}`} className="inline-block text-[13px] text-primary-ink underline underline-offset-2">
        Buka detail proyek lengkap →
      </Link>
    </div>
  );
}
