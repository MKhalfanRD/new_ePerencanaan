"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { exportMasterToExcel } from "@/lib/export-master-excel";

/**
 * Master nomenklatur dalam SATU halaman: Program > Kegiatan > KRO > RO,
 * dengan Indikator RO & Komponen sebagai anak RO, plus daftar Tahun
 * (Periode) di bawahnya. Sebelumnya tiap level punya sub-tab sendiri
 * sehingga hubungan antar level tidak kelihatan tanpa pindah-pindah tab.
 */

type Level = "Program" | "Kegiatan" | "KRO" | "RO" | "IRO" | "Komponen" | "Tahun";

const ENDPOINT: Record<Level, string> = {
  Program: "/master/programs",
  Kegiatan: "/master/kegiatan",
  KRO: "/master/kro",
  RO: "/master/ro",
  IRO: "/master/indikator-ro",
  Komponen: "/master/komponen",
  Tahun: "/master/periodes",
};

/** Level yang id-nya diisi manual (kode nomenklatur), bukan cuid otomatis. */
const ID_MANUAL: Level[] = ["Program", "Kegiatan", "KRO", "RO"];

/**
 * Field yang boleh dikirim ke backend per level. Objek dari endpoint list
 * ikut membawa relasi/timestamp (mis. `komponen.ro`, `createdAt`) yang
 * di-`reset()` ke form — kalau ikut terkirim, Prisma `.update()` menolaknya.
 */
const FIELDS: Record<Level, string[]> = {
  Program: ["id", "code", "name"],
  Kegiatan: ["id", "code", "name"],
  KRO: ["id", "code", "name"],
  RO: ["id", "code", "name", "satuan"],
  IRO: ["nama", "satuan"],
  Komponen: ["code", "name"],
  Tahun: ["label", "startYear", "endYear", "isActive"],
};

interface FormState {
  level: Level;
  /** Induk yang sudah ditentukan dari tombol "+" tempat form dibuka. */
  parentId?: string;
  data?: any;
}

export function NomenklaturTab() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [kegiatan, setKegiatan] = useState<any[]>([]);
  const [kroList, setKROList] = useState<any[]>([]);
  const [roList, setROList] = useState<any[]>([]);
  const [iroList, setIroList] = useState<any[]>([]);
  const [komponenList, setKomponenList] = useState<any[]>([]);
  const [periodes, setPeriodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormState | null>(null);
  const [hapus, setHapus] = useState<{ level: Level; id: string } | null>(null);
  const [menghapus, setMenghapus] = useState(false);
  // Seleksi multi-hapus. Key: "<Level>::<id>" supaya id yang sama di level
  // beda (mis. Program "FC" vs Kegiatan) tidak bentrok.
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMenghapus, setBulkMenghapus] = useState(false);

  const keyOf = (level: Level, id: string | number) => `${level}::${id}`;
  const togglePilih = (level: Level, id: string | number) =>
    setPilih((prev) => {
      const next = new Set(prev);
      const k = keyOf(level, id);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<any>();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, k, kro, ro, iro, komp, per] = await Promise.all([
        api.get("/master/programs"),
        api.get("/master/kegiatan"),
        api.get("/master/kro"),
        api.get("/master/ro"),
        api.get("/master/indikator-ro"),
        api.get("/master/komponen"),
        api.get("/master/periodes"),
      ]);
      setPrograms(p.data);
      setKegiatan(k.data);
      setKROList(kro.data);
      setROList(ro.data);
      setIroList(iro.data);
      setKomponenList(komp.data);
      setPeriodes(per.data);
    } catch {
      toast.error("Gagal memuat master data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Index anak per induk — dihitung sekali, bukan filter() berulang di
  // dalam render tiap node (daftar RO bisa ratusan baris).
  const anak = useMemo(() => {
    const g = <T,>(list: T[], key: (x: T) => string) => {
      const m = new Map<string, T[]>();
      for (const x of list) {
        const k = key(x);
        m.set(k, [...(m.get(k) ?? []), x]);
      }
      return m;
    };
    return {
      kegiatan: g(kegiatan, (k: any) => k.programId),
      kro: g(kroList, (k: any) => k.kegiatanId),
      ro: g(roList, (r: any) => r.kroId),
      iro: g(iroList, (i: any) => i.roId),
      komponen: g(komponenList, (k: any) => k.roId),
    };
  }, [kegiatan, kroList, roList, iroList, komponenList]);

  // Pencarian menyaring di level mana pun; induk tetap tampil kalau salah
  // satu keturunannya cocok, supaya jalurnya tidak putus.
  const cocok = (teks: string) =>
    !search || teks.toLowerCase().includes(search.toLowerCase());

  const roCocok = (r: any) =>
    cocok(`${r.code} ${r.name}`) ||
    (anak.iro.get(r.id) ?? []).some((i: any) => cocok(i.nama)) ||
    (anak.komponen.get(r.id) ?? []).some((k: any) => cocok(`${k.code} ${k.name}`));
  const kroCocok = (k: any) =>
    cocok(`${k.code} ${k.name}`) || (anak.ro.get(k.id) ?? []).some(roCocok);
  const kegCocok = (k: any) =>
    cocok(`${k.code} ${k.name}`) || (anak.kro.get(k.id) ?? []).some(kroCocok);
  const progCocok = (p: any) =>
    cocok(`${p.code} ${p.name}`) ||
    (anak.kegiatan.get(p.id) ?? []).some(kegCocok);

  const bukaTambah = (level: Level, parentId?: string) => {
    setForm({ level, parentId });
    reset({});
  };
  const bukaEdit = (level: Level, data: any) => {
    setForm({ level, data });
    reset({ ...data });
  };

  const onSubmit = async (values: any) => {
    if (!form) return;
    const { level, parentId, data } = form;
    const payload: any = {};
    for (const f of FIELDS[level]) {
      if (values[f] !== undefined && values[f] !== "") payload[f] = values[f];
    }
    if (data) delete payload.id; // id tidak bisa diubah saat edit
    if (parentId) {
      if (level === "Kegiatan") payload.programId = parentId;
      if (level === "KRO") payload.kegiatanId = parentId;
      if (level === "RO") payload.kroId = parentId;
      if (level === "IRO" || level === "Komponen") payload.roId = parentId;
    }
    if (level === "Tahun") {
      payload.startYear = Number(payload.startYear);
      payload.endYear = Number(payload.endYear);
      payload.isActive = !!payload.isActive;
    }
    try {
      if (data) await api.patch(`${ENDPOINT[level]}/${data.id}`, payload);
      else await api.post(ENDPOINT[level], payload);
      toast.success(`${level} berhasil disimpan`);
      setForm(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan");
    }
  };

  const onHapus = async () => {
    if (!hapus) return;
    setMenghapus(true);
    try {
      await api.delete(`${ENDPOINT[hapus.level]}/${hapus.id}`);
      toast.success(`${hapus.level} berhasil dihapus`);
      setHapus(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    } finally {
      setMenghapus(false);
    }
  };

  const onHapusBatch = async () => {
    setBulkMenghapus(true);
    // Kelompokkan per level, satu request bulk-delete per level.
    const perLevel = new Map<Level, string[]>();
    for (const k of pilih) {
      const [level, id] = k.split("::") as [Level, string];
      perLevel.set(level, [...(perLevel.get(level) ?? []), id]);
    }
    try {
      for (const [level, ids] of perLevel) {
        await api.post(`${ENDPOINT[level]}/bulk-delete`, { ids });
      }
      toast.success(`${pilih.size} data berhasil dihapus`);
      setPilih(new Set());
      setBulkOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Sebagian data gagal dihapus");
      setPilih(new Set());
      fetchAll();
    } finally {
      setBulkMenghapus(false);
    }
  };

  const Cek = ({ level, id }: { level: Level; id: string | number }) => (
    <input
      type="checkbox"
      className="h-3.5 w-3.5 shrink-0 rounded border-muted-foreground/40"
      checked={pilih.has(keyOf(level, id))}
      onClick={(e) => e.stopPropagation()}
      onChange={() => togglePilih(level, id)}
    />
  );

  const Aksi = ({ level, item }: { level: Level; item: any }) => (
    <div
      className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => bukaEdit(level, item)}
      >
        <Pencil size={11} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setHapus({ level, id: String(item.id) })}
      >
        <Trash2 size={11} />
      </Button>
    </div>
  );

  const TombolTambah = ({
    level,
    parentId,
    label,
  }: {
    level: Level;
    parentId?: string;
    label: string;
  }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        bukaTambah(level, parentId);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-[10.5px] text-muted-foreground hover:border-primary hover:text-primary"
    >
      <Plus size={10} /> {label}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-muted-foreground" size={22} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: pencarian + export semua master ke Excel */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="h-9 pl-9 text-sm"
            placeholder="Cari program / kegiatan / KRO / RO / komponen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => bukaTambah("Program")}>
          <Plus size={14} className="mr-1.5" /> Program
        </Button>
        <Button
          onClick={() =>
            exportMasterToExcel({
              programs,
              kegiatan,
              kro: kroList,
              ro: roList,
              indikatorRO: iroList,
              komponen: komponenList,
              periodes,
            })
          }
        >
          <FileSpreadsheet size={14} className="mr-1.5" /> Export Excel
        </Button>
      </div>

      {pilih.size > 0 && (
        <div className="sticky top-2 z-10 flex items-center gap-3 rounded-lg border bg-card px-3 py-2 shadow-sm">
          <span className="text-xs font-medium">{pilih.size} item dipilih</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setPilih(new Set())}
          >
            Batal
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="ml-auto h-7"
            onClick={() => setBulkOpen(true)}
          >
            <Trash2 size={13} className="mr-1.5" /> Hapus terpilih
          </Button>
        </div>
      )}

      {/* Pohon nomenklatur */}
      <div className="space-y-2">
        {programs.filter(progCocok).map((prog) => {
          const bukaProg = expanded.has(prog.id);
          return (
            <div
              key={prog.id}
              className="overflow-hidden rounded-lg border bg-card shadow-sm"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggle(prog.id)}
                onKeyDown={(e) => e.key === "Enter" && toggle(prog.id)}
                className="group flex cursor-pointer items-center gap-2.5 bg-muted/50 px-3.5 py-2.5 outline-none hover:bg-muted"
              >
                <Cek level="Program" id={prog.id} />
                <ChevronDown
                  size={14}
                  className={cn(
                    "shrink-0 text-muted-foreground transition-transform",
                    !bukaProg && "-rotate-90",
                  )}
                />
                <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                  {prog.code}
                </Badge>
                <span className="truncate text-xs font-semibold">{prog.name}</span>
                <span className="shrink-0 text-[10.5px] text-muted-foreground">
                  {(anak.kegiatan.get(prog.id) ?? []).length} kegiatan
                </span>
                <Aksi level="Program" item={prog} />
              </div>

              {bukaProg && (
                <div className="space-y-1.5 px-3 py-2.5">
                  {(anak.kegiatan.get(prog.id) ?? [])
                    .filter(kegCocok)
                    .map((keg: any) => {
                      const bukaKeg = expanded.has(keg.id);
                      return (
                        <div key={keg.id} className="rounded-md border">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => toggle(keg.id)}
                            onKeyDown={(e) => e.key === "Enter" && toggle(keg.id)}
                            className="group flex cursor-pointer items-center gap-2.5 px-3 py-2 outline-none hover:bg-accent/40"
                          >
                            <Cek level="Kegiatan" id={keg.id} />
                            <ChevronDown
                              size={12}
                              className={cn(
                                "shrink-0 text-muted-foreground transition-transform",
                                !bukaKeg && "-rotate-90",
                              )}
                            />
                            <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                              {keg.code}
                            </span>
                            <span className="truncate text-xs">{keg.name}</span>
                            <Aksi level="Kegiatan" item={keg} />
                          </div>

                          {bukaKeg && (
                            <div className="space-y-1.5 border-t bg-muted/20 px-3 py-2">
                              {(anak.kro.get(keg.id) ?? [])
                                .filter(kroCocok)
                                .map((kro: any) => {
                                  const bukaKro = expanded.has(kro.id);
                                  return (
                                    <div
                                      key={kro.id}
                                      className="rounded-md border bg-background"
                                    >
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => toggle(kro.id)}
                                        onKeyDown={(e) =>
                                          e.key === "Enter" && toggle(kro.id)
                                        }
                                        className="group flex cursor-pointer items-center gap-2.5 px-3 py-1.5 outline-none hover:bg-accent/40"
                                      >
                                        <Cek level="KRO" id={kro.id} />
                                        <ChevronDown
                                          size={11}
                                          className={cn(
                                            "shrink-0 text-muted-foreground transition-transform",
                                            !bukaKro && "-rotate-90",
                                          )}
                                        />
                                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                                          {kro.code}
                                        </span>
                                        <span className="truncate text-[11.5px]">
                                          {kro.name}
                                        </span>
                                        <Aksi level="KRO" item={kro} />
                                      </div>

                                      {bukaKro && (
                                        <div className="space-y-1 border-t px-3 py-2">
                                          {(anak.ro.get(kro.id) ?? [])
                                            .filter(roCocok)
                                            .map((ro: any) => (
                                              <div
                                                key={ro.id}
                                                className="group rounded border px-2.5 py-1.5"
                                              >
                                                <div className="flex items-center gap-2">
                                                  <Cek level="RO" id={ro.id} />
                                                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                                                    {ro.code}
                                                  </span>
                                                  <span className="truncate text-[11px]">
                                                    {ro.name}
                                                  </span>
                                                  {ro.satuan && (
                                                    <Badge
                                                      variant="outline"
                                                      className="shrink-0 text-[9px]"
                                                    >
                                                      {ro.satuan}
                                                    </Badge>
                                                  )}
                                                  <Aksi level="RO" item={ro} />
                                                </div>

                                                {/* Indikator RO & Komponen —
                                                    anak langsung RO, tampil
                                                    inline supaya tidak perlu
                                                    pindah halaman. */}
                                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-1">
                                                  {(anak.iro.get(ro.id) ?? []).map(
                                                    (i: any) => (
                                                      <span
                                                        key={i.id}
                                                        className="group/chip inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700"
                                                      >
                                                        <Cek level="IRO" id={i.id} />
                                                        IRO: {i.nama} ({i.satuan})
                                                        <button
                                                          onClick={() =>
                                                            bukaEdit("IRO", i)
                                                          }
                                                          className="opacity-0 group-hover/chip:opacity-100"
                                                        >
                                                          <Pencil size={9} />
                                                        </button>
                                                        <button
                                                          onClick={() =>
                                                            setHapus({
                                                              level: "IRO",
                                                              id: i.id,
                                                            })
                                                          }
                                                          className="opacity-0 group-hover/chip:opacity-100"
                                                        >
                                                          <Trash2 size={9} />
                                                        </button>
                                                      </span>
                                                    ),
                                                  )}
                                                  {(
                                                    anak.komponen.get(ro.id) ?? []
                                                  ).map((k: any) => (
                                                    <span
                                                      key={k.id}
                                                      className="group/chip inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700"
                                                    >
                                                      <Cek
                                                        level="Komponen"
                                                        id={k.id}
                                                      />
                                                      <span className="font-mono">
                                                        {k.code}
                                                      </span>{" "}
                                                      {k.name}
                                                      <button
                                                        onClick={() =>
                                                          bukaEdit("Komponen", k)
                                                        }
                                                        className="opacity-0 group-hover/chip:opacity-100"
                                                      >
                                                        <Pencil size={9} />
                                                      </button>
                                                      <button
                                                        onClick={() =>
                                                          setHapus({
                                                            level: "Komponen",
                                                            id: k.id,
                                                          })
                                                        }
                                                        className="opacity-0 group-hover/chip:opacity-100"
                                                      >
                                                        <Trash2 size={9} />
                                                      </button>
                                                    </span>
                                                  ))}
                                                  <TombolTambah
                                                    level="IRO"
                                                    parentId={ro.id}
                                                    label="Indikator RO"
                                                  />
                                                  <TombolTambah
                                                    level="Komponen"
                                                    parentId={ro.id}
                                                    label="Komponen"
                                                  />
                                                </div>
                                              </div>
                                            ))}
                                          <TombolTambah
                                            level="RO"
                                            parentId={kro.id}
                                            label="RO"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              <TombolTambah
                                level="KRO"
                                parentId={keg.id}
                                label="KRO"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  <TombolTambah
                    level="Kegiatan"
                    parentId={prog.id}
                    label="Kegiatan"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tahun (Periode) — ikut di halaman yang sama, bukan tab terpisah */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center gap-2 bg-muted/50 px-3.5 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Tahun
          </span>
          <div className="ml-auto">
            <TombolTambah level="Tahun" label="Tahun" />
          </div>
        </div>
        <div className="divide-y">
          {periodes.length === 0 ? (
            <p className="px-3.5 py-3 text-xs text-muted-foreground">
              Belum ada periode.
            </p>
          ) : (
            periodes.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-2.5 px-3.5 py-2"
              >
                <span className="text-xs font-medium">{p.label}</span>
                <span className="text-[10.5px] text-muted-foreground">
                  {p.startYear}–{p.endYear}
                </span>
                {p.isActive && (
                  <Badge variant="outline" className="text-[9px]">
                    Aktif
                  </Badge>
                )}
                <Aksi level="Tahun" item={p} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Form tambah/edit — satu dialog untuk semua level */}
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent
          className="!w-[85vw] !max-w-xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {form?.data ? `Edit ${form.level}` : `Tambah ${form?.level}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            {form?.level === "Tahun" ? (
              <>
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input
                    className="h-10"
                    placeholder="2025-2029"
                    {...register("label")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tahun Mulai</Label>
                    <Input
                      className="h-10"
                      type="number"
                      {...register("startYear")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tahun Akhir</Label>
                    <Input
                      className="h-10"
                      type="number"
                      {...register("endYear")}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    {...register("isActive")}
                  />
                  Jadikan periode aktif
                </label>
              </>
            ) : form?.level === "IRO" ? (
              <>
                <div className="space-y-2">
                  <Label>
                    Nama Indikator <span className="text-destructive">*</span>
                  </Label>
                  <Input className="h-10" {...register("nama")} />
                </div>
                <div className="space-y-2">
                  <Label>
                    Satuan <span className="text-destructive">*</span>
                  </Label>
                  <Input className="h-10" placeholder="Ha / Km / Unit" {...register("satuan")} />
                </div>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "gap-4",
                    ID_MANUAL.includes(form?.level as Level)
                      ? "grid grid-cols-2"
                      : "space-y-4",
                  )}
                >
                  {ID_MANUAL.includes(form?.level as Level) && (
                    <div className="space-y-2">
                      <Label>
                        ID <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        className="h-10"
                        placeholder="Contoh: FC, 7694, 7694.CBG"
                        disabled={!!form?.data}
                        {...register("id")}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>
                      Kode <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      className="h-10"
                      placeholder={
                        form?.level === "Komponen" ? "Contoh: 300" : undefined
                      }
                      {...register("code")}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>
                    Nama <span className="text-destructive">*</span>
                  </Label>
                  <Input className="h-10" {...register("name")} />
                </div>
                {form?.level === "RO" && (
                  <div className="space-y-2">
                    <Label>Satuan RO</Label>
                    <Input
                      className="h-10"
                      placeholder="Unit / Km / Dokumen"
                      {...register("satuan")}
                    />
                  </div>
                )}
              </>
            )}
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setForm(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!hapus} onOpenChange={() => setHapus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {hapus?.level}?</AlertDialogTitle>
            <AlertDialogDescription>
              Data yang dihapus tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={onHapus}
              disabled={menghapus}
              className="bg-destructive hover:bg-destructive/90"
            >
              {menghapus ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {pilih.size} item terpilih?</AlertDialogTitle>
            <AlertDialogDescription>
              Item yang masih dipakai (mis. RO yang punya paket) akan gagal
              dihapus. Data yang terhapus tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={onHapusBatch}
              disabled={bulkMenghapus}
              className="bg-destructive hover:bg-destructive/90"
            >
              {bulkMenghapus ? "Menghapus..." : `Hapus ${pilih.size} item`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
