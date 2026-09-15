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
  // Kalau "+ Poin" diklik dari section metode tertentu di kolom kegiatan
  // tertentu, metode+kegiatan-nya sudah pasti dari konteks itu — field itu
  // dikunci di dialog supaya tidak disalah-isi ulang. Edit tetap bebas ubah.
  const [poinContext, setPoinContext] = useState(false);

  const metode = useForm<MetodeForm>({ resolver: zodResolver(metodeSchema) });
  const poin = useForm<PoinForm>({ resolver: zodResolver(poinSchema) });

  // Layout 2 kolom: tiap kolom nampilin 1 kegiatan (dipilih dropdown),
  // supaya 4 kegiatan x 4 metode tidak numpuk kepanjangan ke bawah
  // sekaligus. Pilihan kegiatan dibatasi ke yang SUDAH punya poin
  // (Irwa/Supan/Benda/Atab dari referensi 1.xlsx) — kegiatan lain belum
  // ada template evaluasinya, jadi tidak relevan ditampilkan di sini.
  const kegiatanWithData = kegiatanList.filter((k) =>
    poinList.some((p) => p.kegiatanId === k.id),
  );
  const [kegiatanKiri, setKegiatanKiri] = useState("");
  const [kegiatanKanan, setKegiatanKanan] = useState("");
  useEffect(() => {
    if (kegiatanWithData.length === 0) return;
    setKegiatanKiri((prev) => prev || kegiatanWithData[0].id);
    setKegiatanKanan(
      (prev) => prev || kegiatanWithData[1]?.id || kegiatanWithData[0].id,
    );
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
  const onImportMetode = async (rows: Record<string, string>[]) => {
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
    toast.success(`Import selesai: ${created} ditambah, ${updated} diperbarui`);
    fetchAll();
  };

  // Import Poin: metode dicocokkan lewat nama, kegiatan lewat kode (lebih
  // stabil daripada nama). Baris yang metode/kegiatannya tidak ketemu di
  // master dilewati.
  const onImportPoin = async (rows: Record<string, string>[]) => {
    let created = 0;
    let updated = 0;
    let dilewati = 0;
    for (const row of rows) {
      const name = row.name?.trim();
      const metode = metodeList.find(
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
    toast.success(
      `Import selesai: ${created} ditambah, ${updated} diperbarui` +
        (dilewati ? `, ${dilewati} dilewati (metode/kegiatan tidak cocok)` : ""),
    );
    fetchAll();
  };

  // Toolbar Import/Export Poin — di atas grid 2 kolom, bukan bagian dari
  // MasterTable lagi (Poin sekarang dirender sebagai section per metode,
  // bukan tabel datar), jadi Export/Import ditulis ulang ringkas di sini
  // dengan kolom yang sama seperti sebelumnya.
  const poinImportInputRef = useRef<HTMLInputElement>(null);
  const [poinImporting, setPoinImporting] = useState(false);

  const exportPoinExcel = () => {
    const rows = poinList.map((p) => ({
      Metode: p.metode?.name ?? "",
      "Kode Kegiatan": p.kegiatan?.code ?? "",
      Kegiatan: p.kegiatan?.name ?? "",
      "Nama Poin": p.name,
      Score: p.score,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows.length ? rows : [{}]),
      "Poin Evaluasi",
    );
    XLSX.writeFile(
      wb,
      `poin-evaluasi-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const handlePoinImportFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPoinImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
        defval: "",
      });
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
      await onImportPoin(rows);
    } catch (err: any) {
      toast.error(err.message || "Gagal impor file");
    } finally {
      setPoinImporting(false);
    }
  };

  // Toolbar Import/Export Metode — Metode tidak lagi punya MasterTable
  // sendiri (digabung ke tampilan evaluasi per kegiatan), jadi Import/Export
  // ditulis ulang ringkas di sini, sama polanya seperti Poin di atas.
  const metodeImportInputRef = useRef<HTMLInputElement>(null);
  const [metodeImporting, setMetodeImporting] = useState(false);

  const exportMetodeExcel = () => {
    const rows = metodeList.map((m) => ({
      "Nama Metode": m.name,
      "Bobot (%)": Math.round(m.bobot * 100),
      Urutan: m.urutan,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows.length ? rows : [{}]),
      "Metode Evaluasi",
    );
    XLSX.writeFile(
      wb,
      `metode-evaluasi-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const handleMetodeImportFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMetodeImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
        defval: "",
      });
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
      // onImportMetode pakai kolom "bobot" 0..1 — file export pakai "%"
      // biar gampang dibaca manusia, dikonversi balik di sini.
      await onImportMetode(
        rows.map((r) => ({
          ...r,
          bobot: r.bobotPersen ? String(Number(r.bobotPersen) / 100) : "",
        })),
      );
    } catch (err: any) {
      toast.error(err.message || "Gagal impor file");
    } finally {
      setMetodeImporting(false);
    }
  };

  const totalBobot = metodeList.reduce((a, m) => a + m.bobot, 0);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Evaluasi (Multi Criteria Analysis)</h3>
          <p className="text-xs text-muted-foreground">
            Tiap metode: nama, bobot, poin-poinnya (per kegiatan) & score
            tiap poin. Bobot metode berlaku sama untuk semua kegiatan —
            ubah di satu kartu, ikut berubah di kartu metode yang sama pada
            kolom kegiatan lain.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
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
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground w-11">
                Metode
              </span>
              <input
                ref={metodeImportInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleMetodeImportFile}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={metodeImporting}
                onClick={() => metodeImportInputRef.current?.click()}
              >
                {metodeImporting ? (
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
                onClick={exportMetodeExcel}
              >
                <Download size={12} className="mr-1" /> Export
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground w-11">
                Poin
              </span>
              <input
                ref={poinImportInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handlePoinImportFile}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={poinImporting}
                onClick={() => poinImportInputRef.current?.click()}
              >
                {poinImporting ? (
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
                onClick={exportPoinExcel}
              >
                <Download size={12} className="mr-1" /> Export
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { value: kegiatanKiri, onChange: setKegiatanKiri },
            { value: kegiatanKanan, onChange: setKegiatanKanan },
          ].map((kolom, kolomIdx) => (
            <div key={kolomIdx} className="space-y-3">
              <Select value={kolom.value} onValueChange={kolom.onChange}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Pilih kegiatan" />
                </SelectTrigger>
                <SelectContent>
                  {kegiatanWithData.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.code} — {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {[...metodeList]
                .sort((a, b) => a.urutan - b.urutan)
                .map((m) => {
                  const poinMetodeIni = poinList.filter(
                    (p) => p.metodeId === m.id && p.kegiatanId === kolom.value,
                  );
                  const totalScore = poinMetodeIni.reduce(
                    (a, p) => a + p.score,
                    0,
                  );
                  return (
                    <Card key={m.id}>
                      <CardContent className="p-0">
                        <div className="group flex items-center justify-between px-3.5 py-2 border-b bg-muted/40">
                          <span className="text-xs font-semibold">
                            {m.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              bobot {(m.bobot * 100).toFixed(0)}% · total
                              score {totalScore}
                            </span>
                            <TooltipProvider delayDuration={300}>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => openMetode(m)}
                                    >
                                      <Pencil size={11} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Edit metode (nama/bobot — berlaku untuk
                                    semua kegiatan)
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive hover:text-destructive"
                                      onClick={() => deleteMetode(m.id)}
                                    >
                                      <Trash2 size={11} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Hapus metode</TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>
                          </div>
                        </div>
                        <div className="divide-y">
                          {poinMetodeIni.length === 0 ? (
                            <p className="px-3.5 py-2.5 text-[11px] text-muted-foreground italic">
                              Belum ada poin
                            </p>
                          ) : (
                            poinMetodeIni.map((p) => (
                              <div
                                key={p.id}
                                className="group flex items-center gap-2 px-3.5 py-2"
                              >
                                <span className="text-[11.5px] leading-snug flex-1">
                                  {p.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  score {p.score}
                                </span>
                                <TooltipProvider delayDuration={300}>
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
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
                                          className="h-6 w-6 text-destructive hover:text-destructive"
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
                            onClick={() => openPoinInContext(m.id, kolom.value)}
                            disabled={!kolom.value}
                            className="w-full flex items-center gap-1.5 px-3.5 py-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors disabled:opacity-40"
                          >
                            <Plus size={12} /> Poin
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          ))}
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
