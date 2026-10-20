"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Loader2,
  MapPin,
  Package,
  Plus,
  Target,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetBreadcrumb,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSearchBox,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldControl } from "@/components/master/field-control";
import { LokasiPeta } from "@/components/map/lokasi-peta";
import { CascadingWilayah } from "@/components/map/cascading-wilayah";
import { rowsForItem, useSourceData } from "@/lib/option-sources";
import { ringkasPaket, type PaketRingkas } from "@/lib/form-score";
import { formatRupiah } from "@/lib/format-rupiah";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import type { Komponen, RO } from "@/types";
import type { FormItemNode } from "./proyek-form-dialog";
import {
  BarSaldo,
  TahunTerkunci,
  danaTahun,
  hitungSaldo,
  useSaldoKegiatan,
  type BarisDana,
} from "@/components/anggaran/saldo-kegiatan";
import {
  PAKET_BAKU_KEYS,
  PaketLabel,
  SUMBER_DANA,
  alokasiDalamRentang,
  isRequiredPaketItem,
  paketKosong,
  ringkasIsianPaket,
  totalAlokasi,
  type BarisTahun,
  type PaketIsian,
  type PaketSection,
  type SumberDana,
} from "./paket-template";

const NONE = "__NONE__";
const fmt = (n: number, desimal = 0) =>
  n.toLocaleString("id-ID", { maximumFractionDigits: desimal });

/** Input angka dengan pemisah ribuan (1.250.000) — nilai keluar number. */
export function AngkaInput({
  value,
  onChange,
  desimal = false,
  className,
  ...rest
}: {
  value: number | undefined | null;
  onChange: (v: number | undefined) => void;
  desimal?: boolean;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const tampil = (v: number | undefined | null) =>
    v == null ? "" : fmt(v, desimal ? 4 : 0);
  const [teks, setTeks] = useState(tampil(value));
  const baca = (t: string) => {
    const [bulat, pecahan] = t.replace(/\./g, "").split(",");
    if (!bulat && !pecahan) return undefined;
    return Number(`${bulat || 0}${pecahan ? `.${pecahan}` : ""}`);
  };
  useEffect(() => {
    if (baca(teks) !== (value ?? undefined)) setTeks(tampil(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Input
      {...rest}
      inputMode={desimal ? "decimal" : "numeric"}
      className={cn("text-right tabular-nums", className)}
      value={teks}
      onChange={(e) => {
        const [b, ...p] = e.target.value.replace(/\./g, "").split(",");
        const bulat = b.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        const pecahan =
          desimal && p.length ? `,${p.join("").replace(/\D/g, "").slice(0, 4)}` : "";
        const t = (bulat ? Number(bulat).toLocaleString("id-ID") : "") + pecahan;
        setTeks(t);
        onChange(baca(t));
      }}
    />
  );
}

/** Saldo VOLUME per proyek. Saldo anggaran per kegiatan — lihat components/anggaran/saldo-kegiatan. */
export interface SaldoProyek {
  volumeRo?: number | null;
  volumeIro?: number | null;
}

/** Baris status saldo: dipakai (paket lain + paket ini) vs saldo. */
export function statusSaldo(saldo: SaldoProyek, paket: PaketRingkas[]) {
  const r = ringkasPaket(paket);
  return [
    { nama: "Volume RO", dipakai: r.B, batas: saldo.volumeRo, rp: false },
    { nama: "Volume IRO", dipakai: r.C, batas: saldo.volumeIro, rp: false },
  ]
    .filter((s) => s.batas != null)
    .map((s) => ({ ...s, lebih: s.dipakai > (s.batas as number) + 1e-9 }));
}
export const teksAngka = (n: number, rp: boolean) => (rp ? formatRupiah(n) : fmt(n, 4));

// Nilai field inti di paket — dipakai cek "wajib" & status kartu.
function terisi(p: PaketIsian, key: string): boolean {
  switch (key) {
    case "paketSatker": return !!p.satkerId;
    case "paketName": return !!p.name.trim();
    case "paketRo": return !!p.roId;
    case "paketLokasiRo": return p.lokasiRo.length > 0;
    case "paketIndikatorRo": return !!p.indikatorRoId;
    case "paketTahun": return !!p.tahunMulai && !!p.tahunSelesai;
    case "paketAlokasi": {
      const baris = alokasiDalamRentang(p);
      return baris.length > 0 && baris.every((a) => a.komponenId) && baris.some((a) => totalAlokasi(a) > 0);
    }
    case "paketLokasi":
      return p.lokasiSamaProyek || p.latitude != null || !!p.coordinates?.length;
    default: {
      const v = p.formValues[key]?.value;
      return !(v == null || v === "" || v === false || (Array.isArray(v) && !v.length));
    }
  }
}
const kartuLengkap = (p: PaketIsian, s: PaketSection) =>
  s.items.every((i) => !isRequiredPaketItem(i) || i.fieldType === "UPLOAD" || terisi(p, i.key));

const ikonKartu = (s: PaketSection) => {
  const keys = new Set(s.items.map((i) => i.key));
  if (keys.has("paketAlokasi") || keys.has("paketTahun")) return Wallet;
  if (keys.has("paketLokasi")) return MapPin;
  if (keys.has("paketIndikatorRo") || keys.has("paketLokasiRo"))
    return Target;
  return Package;
};
// Field inti yang memakan satu baris penuh.
const LEBAR = new Set(["paketRo", "paketIndikatorRo", "paketAlokasi", "paketLokasi", "paketLokasiRo"]);
function JenisBadge({ jenis }: { jenis?: string }) {
  const pendukung = jenis === "PENDUKUNG";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold",
        pendukung ? "bg-warn/12 text-warn-ink" : "bg-ok/10 text-ok",
      )}
    >
      {pendukung ? "pendukung" : "utama"}
    </span>
  );
}

const LABEL_SUMBER: Record<SumberDana, string> = {
  rm: "RM",
  rmp: "RMP",
  pln: "PLN",
  sbsn: "SBSN",
  kpbu: "KPBU",
};

export function PaketDialog({
  open,
  onClose,
  onSave,
  sections,
  value,
  kegiatanId,
  balaiId,
  satkerTerkunci,
  tahunMin,
  tahunMax,
  saldo,
  paketLain,
  proyekId,
  alokasiLain = [],
  breadcrumb,
}: {
  open: boolean;
  onClose: () => void;
  /** Lempar error = dialog tetap terbuka (mis. ditolak server). */
  onSave: (p: PaketIsian) => Promise<void> | void;
  sections: PaketSection[];
  value: PaketIsian | null;
  kegiatanId?: string | null;
  balaiId?: number | null;
  /** Akun Satker: satker paket otomatis & terkunci. */
  satkerTerkunci?: string | null;
  tahunMin?: number;
  tahunMax?: number;
  saldo: SaldoProyek;
  /** Ringkasan paket lain di proyek ini (utk sisa saldo volume). */
  paketLain: PaketRingkas[];
  /** Proyek tersimpan (pemakaiannya di server tidak dihitung; paketnya dijumlah dari form). */
  proyekId?: string;
  /** Alokasi paket lain di proyek ini — bagian "lain" saldo kegiatan. */
  alokasiLain?: BarisDana[];
  breadcrumb?: { label: string; onClick?: () => void }[];
}) {
  const [p, setP] = useState<PaketIsian>(paketKosong(satkerTerkunci));
  const [saving, setSaving] = useState(false);
  const [roList, setRoList] = useState<RO[]>([]);
  const [komponenList, setKomponenList] = useState<Komponen[]>([]);
  const [satkerList, setSatkerList] = useState<{ id: string; name: string }[]>([]);
  const [provinsiList, setProvinsiList] = useState<{ id: string; name: string }[]>([]);
  const [kroId, setKroId] = useState("");
  const [roSearch, setRoSearch] = useState("");
  const [provSearch, setProvSearch] = useState("");
  // Sumber dana yang ditampilkan per baris tahun.
  const [sumberTahun, setSumberTahun] = useState<Record<number, SumberDana[]>>({});
  const kartuRef = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!open) return;
    Promise.all([api.get("/master/ro"), api.get("/master/komponen"), api.get("/master/provinsi")])
      .then(([r, k, pv]) => {
        setRoList(r.data);
        setKomponenList(k.data);
        setProvinsiList(pv.data);
      })
      .catch(() => toast.error("Gagal memuat data master paket"));
  }, [open]);
  useEffect(() => {
    if (!open || !balaiId) return setSatkerList([]);
    api
      .get(`/master/satker?balaiId=${balaiId}`)
      .then((r) => setSatkerList(r.data))
      .catch(() => setSatkerList([]));
  }, [open, balaiId]);

  useEffect(() => {
    if (!open) return;
    const awal = value ?? paketKosong(satkerTerkunci);
    setP(satkerTerkunci ? { ...awal, satkerId: satkerTerkunci } : awal);
    setSumberTahun(
      Object.fromEntries(
        awal.alokasi.map((a) => {
          const dipakai = SUMBER_DANA.filter((k) => (a[k] ?? 0) > 0);
          return [a.tahun, dipakai.length ? dipakai : (["rm"] as SumberDana[])];
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const ro = roList.find((r) => r.id === p.roId);
  useEffect(() => {
    if (ro) setKroId(ro.kro.id);
  }, [ro]);

  const set = (patch: Partial<PaketIsian>) => setP((cur) => ({ ...cur, ...patch }));
  const roKegiatan = useMemo(
    // Tanpa kegiatan proyek tidak ada RO yang boleh dipilih (bukan semua RO).
    () => roList.filter((r) => !!kegiatanId && r.kro.kegiatan.id === kegiatanId),
    [roList, kegiatanId],
  );
  const kroList = useMemo(() => {
    const m = new Map<string, RO["kro"]>();
    for (const r of roKegiatan) m.set(r.kro.id, r.kro);
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [roKegiatan]);
  // Komponen milik RO paket (RO milik kegiatan proyek), utama & pendukung.
  const komponenRo = komponenList.filter((k) => k.roId === p.roId);
  const iroPilihan = ro?.indikatorRO ?? [];
  const satuanIroList = iroPilihan.find((o) => o.id === p.indikatorRoId)?.satuanList ?? [];
  const tahunList = useMemo(() => {
    const awal = tahunMin ?? new Date().getFullYear();
    const akhir = tahunMax ?? awal + 4;
    return Array.from({ length: Math.max(1, akhir - awal + 1) }, (_, i) => awal + i);
  }, [tahunMin, tahunMax]);
  const rentang =
    p.tahunMulai && p.tahunSelesai && p.tahunMulai <= p.tahunSelesai
      ? Array.from({ length: p.tahunSelesai - p.tahunMulai + 1 }, (_, i) => p.tahunMulai! + i)
      : [];

  const sourceData = useSourceData(
    sections.flatMap((s) =>
      s.items.filter((i) => !PAKET_BAKU_KEYS.includes(i.key)).map((i) => i.optionSource),
    ),
  );
  const nilaiDiPaket = (key: string) =>
    key === "paketRo" ? p.roId : p.formValues[key]?.value;

  const status = statusSaldo(saldo, [
    ...paketLain,
    ...ringkasIsianPaket(p, roList, komponenList),
  ]);
  // Saldo anggaran kegiatan per tahun: lain = kegiatan di luar proyek ini +
  // paket lain proyek ini; ditolak hanya kalau paket ini menambah pemakaian.
  const saldoKeg = useSaldoKegiatan(kegiatanId, tahunList[0], tahunList[tahunList.length - 1], proyekId, open);
  const saldoTahun = (t: number) => saldoKeg?.find((s) => s.tahun === t);
  const terkunci = (t: number) => !!saldoKeg && !saldoTahun(t)?.saldo;
  const barisSaldo = (t: number) => {
    const s = saldoTahun(t);
    const lain = danaTahun(alokasiLain, t);
    for (const k of Object.keys(lain) as (keyof typeof lain)[]) lain[k] += s?.terpakai[k] ?? 0;
    return hitungSaldo(s, lain, danaTahun(p.alokasi, t), danaTahun(value?.alokasi ?? [], t));
  };
  const tahunLebih = rentang.filter((t) => barisSaldo(t)?.some((b) => b.lebih));
  const lebihSaldo = status.some((s) => s.lebih) || tahunLebih.length > 0;

  const ubahBaris = (tahun: number, patch: Partial<BarisTahun>) =>
    setP((cur) => {
      const ada = cur.alokasi.some((a) => a.tahun === tahun);
      return {
        ...cur,
        alokasi: ada
          ? cur.alokasi.map((a) => (a.tahun === tahun ? { ...a, ...patch } : a))
          : [...cur.alokasi, { tahun, ...patch }],
      };
    });
  const ubahAlokasi = (tahun: number, k: SumberDana, v: number | undefined) =>
    ubahBaris(tahun, { [k]: v ?? 0 });
  // Ganti RO: indikator & komponen tiap tahun ikut dikosongkan.
  const gantiRo = (roId: string) =>
    setP((cur) => ({
      ...cur,
      roId,
      indikatorRoId: undefined,
      satuanIro: undefined,
      alokasi: cur.alokasi.map((a) => ({ ...a, komponenId: undefined })),
    }));

  const R: Record<string, (item: FormItemNode) => React.ReactNode> = {
    paketSatker: (item) => (
      <>
        <PaketLabel item={item} htmlFor="paket-satker" />
        <Select
          value={p.satkerId || NONE}
          disabled={!!satkerTerkunci}
          onValueChange={(v) => set({ satkerId: v === NONE ? undefined : v })}
        >
          <SelectTrigger id="paket-satker" className="h-9 w-full text-xs">
            <SelectValue placeholder="Pilih satker" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— Belum dipilih —</SelectItem>
            {satkerList.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!balaiId && (
          <p className="text-[11px] text-muted-foreground">Pilih balai proyek dulu.</p>
        )}
      </>
    ),
    paketName: (item) => (
      <>
        <PaketLabel item={item} htmlFor="paket-nama" />
        <Input
          id="paket-nama"
          className="h-9 text-xs"
          placeholder="Contoh: Pembangunan Bendungan A Paket I"
          value={p.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </>
    ),
    paketRo: (item) => (
      <>
        <PaketLabel item={item} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Select
            value={kroId || undefined}
            onValueChange={(v) => {
              setKroId(v);
              gantiRo("");
            }}
          >
            <SelectTrigger aria-label="KRO" className="h-9 w-full min-w-0 text-xs">
              <SelectValue placeholder="Pilih KRO" />
            </SelectTrigger>
            <SelectContent>
              {kroList.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.code} — {k.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={p.roId || undefined}
            disabled={!kroId}
            onOpenChange={(o) => o && setRoSearch("")}
            onValueChange={gantiRo}
          >
            <SelectTrigger aria-label="RO" className="h-9 w-full min-w-0 text-xs">
              <SelectValue placeholder={kroId ? "Pilih RO" : "Pilih KRO dulu"} />
            </SelectTrigger>
            <SelectContent>
              {roKegiatan.filter((r) => r.kro.id === kroId).length > 20 && (
                <SelectSearchBox value={roSearch} onChange={setRoSearch} placeholder="Cari RO..." />
              )}
              {roKegiatan
                .filter(
                  (r) =>
                    r.kro.id === kroId &&
                    (!roSearch ||
                      `${r.code} ${r.name}`.toLowerCase().includes(roSearch.toLowerCase())),
                )
                .map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </>
    ),
    paketLokasiRo: (item) => (
      <>
        <PaketLabel item={item} />
        <div className="flex flex-wrap items-center gap-1.5">
          {p.lokasiRo.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs text-primary"
            >
              {provinsiList.find((x) => x.id === id)?.name ?? id}
              <button
                type="button"
                aria-label="Hapus provinsi"
                className="rounded-full p-0.5 hover:bg-primary/15"
                onClick={() => set({ lokasiRo: p.lokasiRo.filter((x) => x !== id) })}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <Select
            value=""
            onOpenChange={(o) => o && setProvSearch("")}
            onValueChange={(v) => v && set({ lokasiRo: [...p.lokasiRo, v] })}
          >
            <SelectTrigger aria-label="Tambah provinsi" className="h-8 w-auto gap-1 text-xs">
              <Plus size={12} />
              <SelectValue placeholder="Provinsi" />
            </SelectTrigger>
            <SelectContent>
              <SelectSearchBox value={provSearch} onChange={setProvSearch} placeholder="Cari provinsi..." />
              {provinsiList
                .filter(
                  (x) =>
                    !p.lokasiRo.includes(x.id) &&
                    (!provSearch || x.name.toLowerCase().includes(provSearch.toLowerCase())),
                )
                .map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </>
    ),
    paketIndikatorRo: (item) => (
      <>
        <PaketLabel item={item} />
        <div className="flex gap-2">
          <Select
            value={p.indikatorRoId || undefined}
            disabled={!p.roId}
            onValueChange={(v) => {
              const sat = iroPilihan.find((o) => o.id === v)?.satuanList ?? [];
              set({ indikatorRoId: v, satuanIro: sat[0]?.satuan.name });
            }}
          >
            <SelectTrigger aria-label="Indikator RO" className="h-9 min-w-0 flex-1 text-xs">
              <SelectValue placeholder={p.roId ? "Pilih indikator" : "Pilih RO dulu"} />
            </SelectTrigger>
            <SelectContent>
              {iroPilihan.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {satuanIroList.length > 1 ? (
            <Select value={p.satuanIro || undefined} onValueChange={(v) => set({ satuanIro: v })}>
              <SelectTrigger aria-label="Satuan IRO" className="h-9 w-28 shrink-0 text-xs">
                <SelectValue placeholder="Satuan" />
              </SelectTrigger>
              <SelectContent>
                {satuanIroList.map((x) => (
                  <SelectItem key={x.id} value={x.satuan.name}>
                    {x.satuan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              aria-label="Satuan IRO"
              readOnly
              tabIndex={-1}
              className="h-9 w-28 shrink-0 bg-muted text-xs"
              value={p.satuanIro ?? ""}
              placeholder="Satuan"
            />
          )}
        </div>
        {p.roId && iroPilihan.length === 0 && (
          <p className="text-[11px] text-muted-foreground">RO ini belum punya Indikator RO di master.</p>
        )}
      </>
    ),
    paketTahun: (item) => (
      <>
        <PaketLabel item={item} />
        <div className="flex items-center gap-2">
          {(["tahunMulai", "tahunSelesai"] as const).map((k, i) => (
            <React.Fragment key={k}>
              {i === 1 && <span className="text-xs text-muted-foreground">s.d.</span>}
              <Select
                value={p[k]?.toString() ?? ""}
                onValueChange={(v) => {
                  const n = Number(v);
                  const lain = k === "tahunMulai" ? p.tahunSelesai : p.tahunMulai;
                  // Tahun selesai ikut tahun mulai kalau belum diisi / terbalik.
                  if (k === "tahunMulai" && (!lain || lain < n)) set({ tahunMulai: n, tahunSelesai: n });
                  else if (k === "tahunSelesai" && (!lain || lain > n)) set({ tahunMulai: n, tahunSelesai: n });
                  else set({ [k]: n });
                }}
              >
                <SelectTrigger aria-label={i ? "Tahun selesai" : "Tahun mulai"} className="h-9 flex-1 text-xs">
                  <SelectValue placeholder={i ? "Selesai" : "Mulai"} />
                </SelectTrigger>
                <SelectContent>
                  {tahunList.map((t) => (
                    <SelectItem key={t} value={t.toString()}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </React.Fragment>
          ))}
        </div>
      </>
    ),
    paketAlokasi: (item) => {
      const totalSemua = rentang.reduce(
        (sum, t) => sum + totalAlokasi(p.alokasi.find((a) => a.tahun === t) ?? {}),
        0,
      );
      const satuanRo = ro?.satuan?.name ?? "";
      return (
        <>
          <PaketLabel item={item} />
          {!rentang.length || !p.roId ? (
            <p className="rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
              {!p.roId ? "Pilih RO dulu." : "Pilih tahun pelaksanaan dulu."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              {rentang.map((t) => {
                const a: BarisTahun = p.alokasi.find((x) => x.tahun === t) ?? { tahun: t };
                const komp = komponenRo.find((k) => k.id === a.komponenId);
                const tampil = sumberTahun[t] ?? ["rm"];
                const sisa = SUMBER_DANA.filter((k) => !tampil.includes(k));
                const kunci = terkunci(t);
                const bar = kunci ? null : barisSaldo(t);
                return (
                  <div key={t} className={cn("space-y-2 border-b px-3 py-3 last:border-b-0", kunci && "bg-tier-2")}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{t}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatRupiah(totalAlokasi(a))}
                      </span>
                    </div>
                    {kunci && kegiatanId && <TahunTerkunci kegiatanId={kegiatanId} tahun={t} />}
                    {/* Tahun terkunci: isian lama tetap tersimpan, tidak bisa diubah. */}
                    <fieldset disabled={kunci} className={cn("space-y-2", kunci && "opacity-50")}>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_9.5rem_9.5rem]">
                      <Select
                        value={a.komponenId || undefined}
                        onValueChange={(v) => ubahBaris(t, { komponenId: v })}
                      >
                        <SelectTrigger
                          aria-label={`Komponen ${t}`}
                          className="h-8 w-full min-w-0 text-xs *:data-[slot=select-value]:truncate"
                        >
                          <SelectValue placeholder="Pilih komponen">
                            {komp && (
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate">
                                  {komp.code} — {komp.name}
                                </span>
                                <JenisBadge jenis={komp.jenis} />
                              </span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {komponenRo.map((k) => (
                            <SelectItem key={k.id} value={k.id}>
                              {k.code} — {k.name} <JenisBadge jenis={k.jenis} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(
                        [
                          ["volumeRo", "Vol RO", satuanRo],
                          ["volumeIro", "Vol IRO", p.satuanIro ?? ""],
                        ] as const
                      ).map(([k, l, sat]) => (
                        <div key={k} className="flex items-center rounded-md border bg-background">
                          <AngkaInput
                            aria-label={`${l} ${t}`}
                            desimal
                            className="h-8 min-w-0 border-0 text-xs shadow-none focus-visible:ring-0"
                            placeholder={l}
                            value={a[k]}
                            onChange={(v) => ubahBaris(t, { [k]: v })}
                          />
                          <span className="max-w-16 shrink-0 truncate border-l px-2 text-[11px] text-muted-foreground">
                            {sat || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tampil.map((k) => (
                        <div key={k} className="flex w-[11.5rem] items-center rounded-md border bg-background">
                          <span className="w-12 shrink-0 border-r px-2 text-[11px] font-semibold text-muted-foreground">
                            {LABEL_SUMBER[k]}
                          </span>
                          <AngkaInput
                            aria-label={`${LABEL_SUMBER[k]} ${t}`}
                            className="h-8 border-0 text-xs shadow-none focus-visible:ring-0"
                            placeholder="0"
                            value={a[k] || undefined}
                            onChange={(v) => ubahAlokasi(t, k, v)}
                          />
                          {tampil.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Hapus ${LABEL_SUMBER[k]}`}
                              className="px-1.5 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                ubahAlokasi(t, k, 0);
                                setSumberTahun((cur) => ({ ...cur, [t]: tampil.filter((x) => x !== k) }));
                              }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      {sisa.length > 0 && (
                        <Select
                          value=""
                          onValueChange={(v) =>
                            setSumberTahun((cur) => ({ ...cur, [t]: [...tampil, v as SumberDana] }))
                          }
                        >
                          <SelectTrigger aria-label={`Tambah sumber dana ${t}`} className="h-8 w-auto gap-1 text-xs">
                            <Plus size={12} />
                            <SelectValue placeholder="Sumber dana" />
                          </SelectTrigger>
                          <SelectContent>
                            {sisa.map((k) => (
                              <SelectItem key={k} value={k}>
                                {LABEL_SUMBER[k]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    </fieldset>
                    {bar && <BarSaldo baris={bar} />}
                  </div>
                );
              })}
              <div className="flex justify-between bg-muted/50 px-3 py-2 text-xs font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatRupiah(totalSemua)}</span>
              </div>
            </div>
          )}
          {p.roId && komponenRo.length === 0 && (
            <p className="text-[11px] text-muted-foreground">RO ini belum punya komponen di master.</p>
          )}
        </>
      );
    },
    paketLokasi: (item) => (
      <>
        <PaketLabel item={item} />
        <div className="flex gap-2">
          {[
            [true, "Sama dengan lokasi proyek"],
            [false, "Lokasi sendiri"],
          ].map(([v, l]) => (
            <Button
              key={String(v)}
              type="button"
              size="sm"
              variant={p.lokasiSamaProyek === v ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() =>
                set({
                  lokasiSamaProyek: v as boolean,
                  tipeKoordinat: v ? undefined : (p.tipeKoordinat ?? "TITIK"),
                })
              }
            >
              {l as string}
            </Button>
          ))}
        </div>
        {!p.lokasiSamaProyek && (
          <div className="pt-1">
            <LokasiPeta
              value={{
                tipeKoordinat: p.tipeKoordinat ?? "TITIK",
                latitude: p.latitude,
                longitude: p.longitude,
                coordinates: p.coordinates ?? [],
              }}
              onChange={(patch) => set(patch as Partial<PaketIsian>)}
              onWilayahDetected={(w) => set(w as Partial<PaketIsian>)}
            />
            <div className="pt-3">
              <CascadingWilayah
                value={{
                  provinceId: p.provinceId,
                  provinceName: p.provinceName,
                  cityId: p.cityId,
                  cityName: p.cityName,
                  districtId: p.districtId,
                  districtName: p.districtName,
                  villageId: p.villageId,
                  villageName: p.villageName,
                }}
                onChange={(w) => set(w as Partial<PaketIsian>)}
              />
            </div>
          </div>
        )}
      </>
    ),
  };

  const simpan = async () => {
    for (const s of sections)
      for (const i of s.items)
        if (isRequiredPaketItem(i) && i.fieldType !== "UPLOAD" && !terisi(p, i.key))
          return toast.error(`Lengkapi "${i.label}"`);
    // Tiap tahun wajib 1 komponen (penentu utama/pendukung di Valuasi).
    const tanpaKomponen = rentang.find((t) => {
      const a = p.alokasi.find((x) => x.tahun === t);
      // Tahun terkunci tanpa isian lama memang dibiarkan kosong.
      return !(terkunci(t) && !a) && !a?.komponenId;
    });
    if (p.roId && komponenRo.length && tanpaKomponen)
      return toast.error(`Pilih komponen tahun ${tanpaKomponen}`);
    if (tahunLebih.length) return toast.error(`Alokasi ${tahunLebih.join(", ")} melebihi saldo kegiatan`);
    if (lebihSaldo) return toast.error("Volume paket melebihi saldo proyek");
    setSaving(true);
    try {
      await onSave({ ...p, alokasi: alokasiDalamRentang(p) });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Gagal menyimpan paket");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent layer="2" className="!p-0" onInteractOutside={(e) => e.preventDefault()}>
        <SheetHeader className="gap-2">
          {breadcrumb && <SheetBreadcrumb items={breadcrumb} />}
          <SheetTitle className="text-base leading-snug">
            {value ? "Edit paket" : "Tambah paket"}
            {p.kodePaket && (
              <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                {p.kodePaket}
              </span>
            )}
          </SheetTitle>
          {sections.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {sections.map((s) => {
                const ok = kartuLengkap(p, s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      kartuRef.current[s.id]?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                      ok ? "border-ok/30 bg-ok/10 text-ok" : "bg-background",
                    )}
                  >
                    {ok && <Check size={11} />}
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}
        </SheetHeader>

        <SheetBody className="space-y-4 px-5 py-5">
          {sections.map((s) => {
            const Ikon = ikonKartu(s);
            const ok = kartuLengkap(p, s);
            return (
              <div
                key={s.id}
                ref={(el) => {
                  kartuRef.current[s.id] = el;
                }}
                className="scroll-mt-4 rounded-xl border bg-card"
              >
                <div className="flex items-center gap-2.5 border-b px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Ikon size={15} className="text-primary" />
                  </div>
                  <p className="flex-1 text-sm font-semibold">{s.label}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      ok ? "bg-ok/10 text-ok" : "bg-warn/12 text-warn-ink",
                    )}
                  >
                    {ok ? "✓ Lengkap" : "Belum lengkap"}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                  {s.items.map((item) =>
                    R[item.key] ? (
                      <div
                        key={item.id}
                        className={cn(
                          "min-w-0 space-y-1.5",
                          (LEBAR.has(item.key) || item.width === "FULL") && "sm:col-span-2",
                        )}
                      >
                        {R[item.key](item)}
                      </div>
                    ) : item.fieldType === "UPLOAD" ? null : (
                      <div key={item.id} className={cn(item.width === "FULL" && "sm:col-span-2")}>
                        <FieldControl
                          mode="fill"
                          item={item}
                          value={p.formValues[item.key]}
                          onChange={(patch) =>
                            setP((cur) => ({
                              ...cur,
                              formValues: {
                                ...cur.formValues,
                                [item.key]: { ...cur.formValues[item.key], ...patch },
                              },
                            }))
                          }
                          sourceRows={rowsForItem(item, sourceData, nilaiDiPaket, kegiatanId)}
                        />
                      </div>
                    ),
                  )}
                </div>
              </div>
            );
          })}
          {!sections.length && (
            <p className="rounded-xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
              Belum ada bagian &quot;per paket&quot; di tab Pemaketan (Master Data &gt; Form Proyek).
            </p>
          )}
        </SheetBody>

        <SheetFooter className="items-center">
          <div className="mr-auto min-w-0 space-y-0.5 text-xs">
            {status.map((s) => (
              <p key={s.nama} className={cn(s.lebih ? "font-medium text-destructive" : "text-muted-foreground")}>
                {s.nama}:{" "}
                {s.lebih
                  ? `${teksAngka(s.dipakai, s.rp)} melebihi saldo ${teksAngka(s.batas!, s.rp)}`
                  : `sisa ${teksAngka(s.batas! - s.dipakai, s.rp)}`}
              </p>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="button" onClick={simpan} disabled={saving || lebihSaldo}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan paket
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
