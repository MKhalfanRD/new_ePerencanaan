"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import * as XLSX from "xlsx";
import { Loader2, Plus, Pencil, Trash2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";

/**
 * Master evaluasi (MCA): Metode (dulu enum tetap dengan bobot hardcoded,
 * sekarang master data supaya bobotnya bisa diubah admin) & Poin (item
 * per metode, per kegiatan — dipakai form proyek untuk checkbox tagging).
 * Digabung jadi satu CRUD (bukan Metode & Poin terpisah) karena keduanya
 * cuma masuk akal dilihat bersama: metode + bobotnya, poin-poin di
 * dalamnya + score-nya, total score, total bobot.
 *
 * `urutan` pada Poin sengaja dibuang — cuma urutan baris dari Excel asal,
 * tidak pernah dipakai di hitungSkorEvaluasi() (skor cuma dari
 * score/bobot), jadi murni field mati. `MetodeEvaluasi.urutan` beda,
 * dipertahankan — itu urutan tampil 4 metode (Urgensitas/Kesiapan
 * Teknis/Tematik/Valuasi), bukan urutan poin.
 */

interface Metode {
  id: string;
  name: string;
  bobot: number;
  urutan: number;
}

interface Kegiatan {
  id: string;
  name: string;
  code: string;
}

interface Poin {
  id: string;
  kegiatanId: string;
  kegiatan?: Kegiatan;
  metodeId: string;
  metode?: Metode;
  name: string;
  score: number;
}

const metodeSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  bobot: z.number().min(0).max(1),
  urutan: z.number().optional(),
});
type MetodeForm = z.infer<typeof metodeSchema>;

const poinSchema = z.object({
  kegiatanId: z.string().min(1, "Kegiatan wajib dipilih"),
  metodeId: z.string().min(1, "Metode wajib dipilih"),
  name: z.string().min(1, "Nama wajib diisi"),
  score: z.number().min(1),
});
type PoinForm = z.infer<typeof poinSchema>;

export function EvaluasiTab() {
  const [metodeList, setMetodeList] = useState<Metode[]>([]);
  const [poinList, setPoinList] = useState<Poin[]>([]);
  const [kegiatanList, setKegiatanList] = useState<Kegiatan[]>([]);
  const [loading, setLoading] = useState(true);

  const [metodeForm, setMetodeForm] = useState<Metode | "new" | null>(null);
  const [poinForm, setPoinForm] = useState<Poin | "new" | null>(null);
  // Kalau "+ Poin" diklik dari section metode tertentu, metode+kegiatan-nya
  // sudah pasti dari konteks itu — field itu dikunci di dialog supaya tidak
  // disalah-isi ulang. Edit tetap bebas ubah.
  const [poinContext, setPoinContext] = useState(false);

  const metode = useForm<MetodeForm>({ resolver: zodResolver(metodeSchema) });
  const poin = useForm<PoinForm>({ resolver: zodResolver(poinSchema) });

  // Tampilkan evaluasi 1 kegiatan per waktu (dropdown) — sebelumnya 2 kolom
  // berdampingan yang malah menyulitkan mata memisahkan kartu metode milik
  // kegiatan mana. Pilihan kegiatan dibatasi ke yang SUDAH punya poin
  // (Irwa/Supan/Benda/Atab dari referensi 1.xlsx) — kegiatan lain belum
  // ada template evaluasinya, jadi tidak relevan ditampilkan di sini.
  const kegiatanWithData = kegiatanList.filter((k) =>
    poinList.some((p) => p.kegiatanId === k.id),
  );
  const [kegiatanSelected, setKegiatanSelected] = useState("");
  useEffect(() => {
    if (kegiatanWithData.length === 0) return;
    setKegiatanSelected((prev) => prev || kegiatanWithData[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poinList, kegiatanList]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [m, p, k] = await Promise.all([
        api.get("/master/metode-evaluasi"),
        api.get("/master/evaluasi-item"),
        api.get("/master/kegiatan"),
      ]);
      setMetodeList(m.data);
      setPoinList(p.data);
      setKegiatanList(k.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memuat data evaluasi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openMetode = (item: Metode | "new") => {
    setMetodeForm(item);
    metode.reset(
      item === "new" ? { bobot: 0.2, urutan: metodeList.length + 1 } : item,
    );
  };
  const submitMetode = async (data: MetodeForm) => {
    try {
      if (metodeForm !== "new" && metodeForm) {
        await api.patch(`/master/metode-evaluasi/${metodeForm.id}`, data);
        toast.success("Metode evaluasi diperbarui");
      } else {
        await api.post("/master/metode-evaluasi", data);
        toast.success("Metode evaluasi ditambahkan");
      }
      setMetodeForm(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };
  const deleteMetode = async (id: string | number) => {
    try {
      await api.delete(`/master/metode-evaluasi/${id}`);
      toast.success("Metode evaluasi dihapus");
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  const openPoin = (item: Poin | "new") => {
    setPoinForm(item);
    setPoinContext(false);
    poin.reset(
      item === "new"
        ? { score: 1 }
        : {
            kegiatanId: item.kegiatanId,
            metodeId: item.metodeId,
            name: item.name,
            score: item.score,
          },
    );
  };
  // Dipanggil dari tombol "+ Poin" di dalam section metode tertentu — metode
  // & kegiatannya sudah pasti dari konteks klik, tidak perlu dipilih ulang.
  const openPoinInContext = (metodeId: string, kegiatanId: string) => {
    setPoinForm("new");
    setPoinContext(true);
    poin.reset({ metodeId, kegiatanId, score: 1 });
  };
  const submitPoin = async (data: PoinForm) => {
    try {
      if (poinForm !== "new" && poinForm) {
        await api.patch(`/master/evaluasi-item/${poinForm.id}`, data);
        toast.success("Poin evaluasi diperbarui");
      } else {
        await api.post("/master/evaluasi-item", data);
        toast.success("Poin evaluasi ditambahkan");
      }
      setPoinForm(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };
  const deletePoin = async (id: string | number) => {
    try {
      await api.delete(`/master/evaluasi-item/${id}`);
      toast.success("Poin evaluasi dihapus");
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  // Import Metode: id-nya cuid, dicocokkan lewat nama (case-insensitive).
  // Dipanggil dari handleEvaluasiImportFile SEBELUM importPoinRows, karena
  // poin butuh metode-nya sudah ada di DB untuk bisa dicocokkan.
  const importMetodeRows = async (rows: Record<string, string>[]) => {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const name = row.name?.trim();
      const bobot = Number(row.bobot);
      if (!name || Number.isNaN(bobot)) continue;
      const payload = {
        name,
        bobot,
        urutan: row.urutan ? Number(row.urutan) : undefined,
      };
      const existing = metodeList.find(
        (m) => m.name.toLowerCase() === name.toLowerCase(),
      );
      try {
        if (existing) {
          await api.patch(`/master/metode-evaluasi/${existing.id}`, payload);
          updated++;
        } else {
          await api.post("/master/metode-evaluasi", payload);
          created++;
        }
      } catch {
        // dilewati, lanjut baris berikutnya
      }
    }
    return { created, updated };
  };

  // Import Poin: metode dicocokkan lewat nama, kegiatan lewat kode (lebih
  // stabil daripada nama). Baris yang metode/kegiatannya tidak ketemu di
  // master dilewati. `metodeSource` dioper eksplisit (bukan state closure)
  // supaya metode yang baru saja dibuat oleh importMetodeRows di file yang
  // sama ikut bisa dicocokkan — state React belum tentu ter-update sinkron.
  const importPoinRows = async (
    rows: Record<string, string>[],
    metodeSource: Metode[],
  ) => {
    let created = 0;
    let updated = 0;
    let dilewati = 0;
    for (const row of rows) {
      const name = row.name?.trim();
      const metode = metodeSource.find(
        (m) => m.name.toLowerCase() === (row.metode || "").trim().toLowerCase(),
      );
      const kegiatan = kegiatanList.find(
        (k) => k.code === (row.kodeKegiatan || "").trim(),
      );
      const score = Number(row.score) || 1;
      if (!name || !metode || !kegiatan) {
        dilewati++;
        continue;
      }
      const payload = {
        name,
        metodeId: metode.id,
        kegiatanId: kegiatan.id,
        score,
      };
      const existing = poinList.find(
        (p) =>
          p.metodeId === metode.id &&
          p.kegiatanId === kegiatan.id &&
          p.name.toLowerCase() === name.toLowerCase(),
      );
      try {
        if (existing) {
          await api.patch(`/master/evaluasi-item/${existing.id}`, payload);
          updated++;
        } else {
          await api.post("/master/evaluasi-item", payload);
          created++;
        }
      } catch {
        dilewati++;
      }
    }
    return { created, updated, dilewati };
  };

  // Import/Export evaluasi jadi SATU kesatuan (bukan Metode & Poin
  // terpisah) — 1 file .xlsx dengan 2 sheet "Metode" dan "Poin". Tetap 2
  // sheet (bukan 1 sheet flat) karena bobot metode global (bukan per
  // kegiatan): flatten-total akan memaksa duplikasi bobot di tiap baris
  // poin tiap kegiatan, lebih rawan salah parse balik.
  const evaluasiImportInputRef = useRef<HTMLInputElement>(null);
  const [evaluasiImporting, setEvaluasiImporting] = useState(false);

  const exportEvaluasiExcel = () => {
    const metodeRows = metodeList.map((m) => ({
      "Nama Metode": m.name,
      "Bobot (%)": Math.round(m.bobot * 100),
      Urutan: m.urutan,
    }));
    const poinRows = poinList.map((p) => ({
      Metode: p.metode?.name ?? "",
      "Kode Kegiatan": p.kegiatan?.code ?? "",
      Kegiatan: p.kegiatan?.name ?? "",
      "Nama Poin": p.name,
      Score: p.score,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(metodeRows.length ? metodeRows : [{}]),
      "Metode",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(poinRows.length ? poinRows : [{}]),
      "Poin",
    );
    XLSX.writeFile(
      wb,
      `evaluasi-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const handleEvaluasiImportFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEvaluasiImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const metodeSheetName =
        wb.SheetNames.find((n) => n === "Metode") ?? wb.SheetNames[0];
      const poinSheetName =
        wb.SheetNames.find((n) => n === "Poin") ?? wb.SheetNames[1];

      let metodeCreated = 0;
      let metodeUpdated = 0;
      let metodeSource = metodeList;

      if (metodeSheetName) {
        const raw = XLSX.utils.sheet_to_json<Record<string, any>>(
          wb.Sheets[metodeSheetName],
          { defval: "" },
        );
        const labelToKey: Record<string, string> = {
          "Nama Metode": "name",
          "Bobot (%)": "bobotPersen",
          Urutan: "urutan",
        };
        const rows = raw.map((r) =>
          Object.fromEntries(
            Object.entries(r)
              .filter(([label]) => labelToKey[label])
              .map(([label, v]) => [labelToKey[label], String(v ?? "").trim()]),
          ),
        );
        // importMetodeRows pakai kolom "bobot" 0..1 — file export pakai "%"
        // biar gampang dibaca manusia, dikonversi balik di sini.
        const result = await importMetodeRows(
          rows.map((r) => ({
            ...r,
            bobot: r.bobotPersen ? String(Number(r.bobotPersen) / 100) : "",
          })),
        );
        metodeCreated = result.created;
        metodeUpdated = result.updated;
        // Re-fetch supaya metode yang baru saja dibuat di atas ikut bisa
        // dicocokkan saat import Poin di bawah (state lama belum reflect).
        const fresh = await api.get("/master/metode-evaluasi");
        metodeSource = fresh.data;
        setMetodeList(metodeSource);
      }

      let poinCreated = 0;
      let poinUpdated = 0;
      let poinDilewati = 0;

      if (poinSheetName) {
        const raw = XLSX.utils.sheet_to_json<Record<string, any>>(
          wb.Sheets[poinSheetName],
          { defval: "" },
        );
        const labelToKey: Record<string, string> = {
          Metode: "metode",
          "Kode Kegiatan": "kodeKegiatan",
          "Nama Poin": "name",
          Score: "score",
        };
        const rows = raw.map((r) =>
          Object.fromEntries(
            Object.entries(r)
              .filter(([label]) => labelToKey[label])
              .map(([label, v]) => [labelToKey[label], String(v ?? "").trim()]),
          ),
        );
        const result = await importPoinRows(rows, metodeSource);
        poinCreated = result.created;
        poinUpdated = result.updated;
        poinDilewati = result.dilewati;
      }

      const created = metodeCreated + poinCreated;
      const updated = metodeUpdated + poinUpdated;
      toast.success(
        `Import selesai: ${created} ditambah, ${updated} diperbarui` +
          (poinDilewati
            ? `, ${poinDilewati} poin dilewati (metode/kegiatan tidak cocok)`
            : ""),
      );
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Gagal impor file");
    } finally {
      setEvaluasiImporting(false);
    }
  };

  const totalBobot = metodeList.reduce((a, m) => a + m.bobot, 0);
  const kegiatanAktif = kegiatanWithData.find((k) => k.id === kegiatanSelected);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Evaluasi (Multi Criteria Analysis)</h3>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card shadow-sm px-3 py-2">
          <div className="flex items-center gap-4">
            <span
              className={`text-xs font-semibold ${
                Math.abs(totalBobot - 1) > 0.001
                  ? "text-destructive"
                  : "text-emerald-700"
              }`}
            >
              Total Bobot: {(totalBobot * 100).toFixed(0)}%
            </span>
            <button
              type="button"
              onClick={() => openMetode("new")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus size={13} /> Metode
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={evaluasiImportInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleEvaluasiImportFile}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={evaluasiImporting}
              onClick={() => evaluasiImportInputRef.current?.click()}
            >
              {evaluasiImporting ? (
                <Loader2 size={12} className="mr-1 animate-spin" />
              ) : (
                <Upload size={12} className="mr-1" />
              )}
              Import
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={exportEvaluasiExcel}
            >
              <Download size={12} className="mr-1" /> Export
            </Button>
          </div>
        </div>

        <div className="max-w-xl">
          <Select value={kegiatanSelected} onValueChange={setKegiatanSelected}>
            <SelectTrigger className="h-10 w-full min-w-0 bg-card shadow-sm *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1">
              <SelectValue placeholder="Pilih kegiatan" />
            </SelectTrigger>
            <SelectContent>
              {kegiatanWithData.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  <span className="font-mono text-[10px] mr-1 shrink-0">
                    {k.code}
                  </span>
                  <span className="truncate">{k.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {[...metodeList]
            .sort((a, b) => a.urutan - b.urutan)
            .map((m) => {
              const poinMetodeIni = poinList.filter(
                (p) => p.metodeId === m.id && p.kegiatanId === kegiatanSelected,
              );
              const totalScore = poinMetodeIni.reduce((a, p) => a + p.score, 0);
              return (
                <Card key={m.id} className="overflow-hidden py-0 gap-0">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b bg-slate-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold truncate">
                          {m.name}
                        </span>
                        <Badge variant="dot" dotColor="slate">
                          bobot {(m.bobot * 100).toFixed(0)}%
                        </Badge>
                        <Badge
                          variant="dot"
                          dotColor={poinMetodeIni.length ? "emerald" : "slate"}
                        >
                          total score {totalScore}
                        </Badge>
                      </div>
                      <TooltipProvider delayDuration={300}>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground/70 hover:text-foreground"
                                onClick={() => openMetode(m)}
                              >
                                <Pencil size={13} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Edit metode (nama/bobot — berlaku untuk semua
                              kegiatan)
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground/70 hover:text-destructive"
                                onClick={() => deleteMetode(m.id)}
                              >
                                <Trash2 size={13} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Hapus metode</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </div>
                    <div className="divide-y">
                      {poinMetodeIni.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-foreground/60 italic">
                          Belum ada poin
                        </p>
                      ) : (
                        poinMetodeIni.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center gap-2 px-4 py-2"
                          >
                            <span className="text-xs leading-snug flex-1">
                              {p.name}
                            </span>
                            <Badge variant="dot" dotColor="slate" className="shrink-0">
                              score {p.score}
                            </Badge>
                            <TooltipProvider delayDuration={300}>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground/70 hover:text-foreground"
                                      onClick={() => openPoin(p)}
                                    >
                                      <Pencil size={11} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground/70 hover:text-destructive"
                                      onClick={() => deletePoin(p.id)}
                                    >
                                      <Trash2 size={11} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Hapus</TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>
                          </div>
                        ))
                      )}
                      <button
                        type="button"
                        onClick={() => openPoinInContext(m.id, kegiatanSelected)}
                        disabled={!kegiatanSelected}
                        className="w-full flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors disabled:opacity-40"
                      >
                        <Plus size={12} /> Poin
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          {!loading && metodeList.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Belum ada metode evaluasi.
            </p>
          )}
          {!loading && metodeList.length > 0 && !kegiatanAktif && (
            <p className="text-xs text-muted-foreground italic">
              Belum ada kegiatan dengan data evaluasi.
            </p>
          )}
        </div>
      </div>

      {/* Form Metode */}
      <Dialog
        open={!!metodeForm}
        onOpenChange={(v) => !v && setMetodeForm(null)}
      >
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {metodeForm === "new" ? "Tambah Metode" : "Edit Metode"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={metode.handleSubmit(submitMetode)}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label>
                Nama Metode <span className="text-destructive">*</span>
              </Label>
              <Input
                className="h-10"
                placeholder="Urgensitas"
                {...metode.register("name")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Bobot (0..1) <span className="text-destructive">*</span>
                </Label>
                <Input
                  className="h-10"
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  placeholder="0.4"
                  {...metode.register("bobot", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Urutan</Label>
                <Input
                  className="h-10"
                  type="number"
                  {...metode.register("urutan", { valueAsNumber: true })}
                />
              </div>
            </div>
            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMetodeForm(null)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={metode.formState.isSubmitting}>
                {metode.formState.isSubmitting && (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Form Poin */}
      <Dialog open={!!poinForm} onOpenChange={(v) => !v && setPoinForm(null)}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {poinForm === "new" ? "Tambah Poin" : "Edit Poin"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={poin.handleSubmit(submitPoin)}
            className="space-y-4 py-2"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Metode <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={poin.watch("metodeId")}
                  onValueChange={(v) => poin.setValue("metodeId", v)}
                  disabled={poinContext}
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Pilih metode" />
                  </SelectTrigger>
                  <SelectContent>
                    {metodeList.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Kegiatan <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={poin.watch("kegiatanId")}
                  onValueChange={(v) => poin.setValue("kegiatanId", v)}
                  disabled={poinContext}
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Pilih kegiatan" />
                  </SelectTrigger>
                  <SelectContent>
                    {kegiatanList.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.code} — {k.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Nama Poin <span className="text-destructive">*</span>
              </Label>
              <Input
                className="h-10"
                placeholder="Contoh: Sudah ada studi kelayakan"
                {...poin.register("name")}
              />
              {poin.formState.errors.name && (
                <p className="text-destructive text-xs">
                  {poin.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Score <span className="text-destructive">*</span>
              </Label>
              <Input
                className="h-10"
                type="number"
                min={1}
                {...poin.register("score", { valueAsNumber: true })}
              />
            </div>
            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPoinForm(null)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={poin.formState.isSubmitting}>
                {poin.formState.isSubmitting && (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
