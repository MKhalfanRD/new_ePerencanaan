"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import * as XLSX from "xlsx";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Download,
} from "lucide-react";
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
 * Master Prioritas Nasional RPJMN: PN > PP > KP, 3 tingkat. Paket/Proyek
 * memilih KP-nya lewat select berjenjang di form (lihat planning-form-dialog).
 */

interface PN {
  id: string;
  code: string;
  name: string;
}
interface PP {
  id: string;
  code: string;
  name: string;
  prioritasNasionalId: string;
  prioritasNasional?: PN;
}
interface KP {
  id: string;
  code: string;
  name: string;
  programPrioritasId: string;
  programPrioritas?: PP & { prioritasNasional: PN };
}

const codeNameSchema = { code: "", name: "" };

export function PnppkpTab() {
  const [pnList, setPnList] = useState<PN[]>([]);
  const [ppList, setPpList] = useState<PP[]>([]);
  const [kpList, setKpList] = useState<KP[]>([]);
  const [loading, setLoading] = useState(true);

  const [pnForm, setPnForm] = useState<PN | "new" | null>(null);
  const [ppForm, setPpForm] = useState<PP | "new" | null>(null);
  const [kpForm, setKpForm] = useState<KP | "new" | null>(null);
  // Expand/collapse tree — kunci pakai id apa adanya (cuid unik lintas
  // level), sama seperti pola di nomenklatur-tab.tsx.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const pn = useForm<{ code: string; name: string }>();
  const pp = useForm<{ code: string; name: string; prioritasNasionalId: string }>();
  const kp = useForm<{ code: string; name: string; programPrioritasId: string }>();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, pr, k] = await Promise.all([
        api.get("/master/prioritas-nasional"),
        api.get("/master/program-prioritas"),
        api.get("/master/kegiatan-prioritas"),
      ]);
      setPnList(p.data);
      setPpList(pr.data);
      setKpList(k.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memuat data PN/PP/KP");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // ===== PN =====
  const openPn = (item: PN | "new") => {
    setPnForm(item);
    pn.reset(item === "new" ? codeNameSchema : { code: item.code, name: item.name });
  };
  const submitPn = async (data: { code: string; name: string }) => {
    try {
      if (pnForm !== "new" && pnForm) {
        await api.patch(`/master/prioritas-nasional/${pnForm.id}`, data);
        toast.success("PN diperbarui");
      } else {
        await api.post("/master/prioritas-nasional", data);
        toast.success("PN ditambahkan");
      }
      setPnForm(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };
  const deletePn = async (id: string | number) => {
    try {
      await api.delete(`/master/prioritas-nasional/${id}`);
      toast.success("PN dihapus");
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  // ===== PP =====
  // parentPnId cuma dipakai saat item === "new" (diklik dari "+ PP" di
  // bawah PN tertentu) — prefill supaya tidak perlu pilih ulang.
  const openPp = (item: PP | "new", parentPnId?: string) => {
    setPpForm(item);
    pp.reset(
      item === "new"
        ? { ...codeNameSchema, prioritasNasionalId: parentPnId ?? "" }
        : {
            code: item.code,
            name: item.name,
            prioritasNasionalId: item.prioritasNasionalId,
          },
    );
  };
  const submitPp = async (data: {
    code: string;
    name: string;
    prioritasNasionalId: string;
  }) => {
    try {
      if (ppForm !== "new" && ppForm) {
        await api.patch(`/master/program-prioritas/${ppForm.id}`, data);
        toast.success("PP diperbarui");
      } else {
        await api.post("/master/program-prioritas", data);
        toast.success("PP ditambahkan");
      }
      setPpForm(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };
  const deletePp = async (id: string | number) => {
    try {
      await api.delete(`/master/program-prioritas/${id}`);
      toast.success("PP dihapus");
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  // ===== KP =====
  const openKp = (item: KP | "new", parentPpId?: string) => {
    setKpForm(item);
    kp.reset(
      item === "new"
        ? { ...codeNameSchema, programPrioritasId: parentPpId ?? "" }
        : {
            code: item.code,
            name: item.name,
            programPrioritasId: item.programPrioritasId,
          },
    );
  };
  const submitKp = async (data: {
    code: string;
    name: string;
    programPrioritasId: string;
  }) => {
    try {
      if (kpForm !== "new" && kpForm) {
        await api.patch(`/master/kegiatan-prioritas/${kpForm.id}`, data);
        toast.success("KP diperbarui");
      } else {
        await api.post("/master/kegiatan-prioritas", data);
        toast.success("KP ditambahkan");
      }
      setKpForm(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };
  const deleteKp = async (id: string | number) => {
    try {
      await api.delete(`/master/kegiatan-prioritas/${id}`);
      toast.success("KP dihapus");
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  // ===== Import (per tabel, cocok lewat "code") =====
  const onImportPn = async (rows: Record<string, string>[]) => {
    let created = 0,
      updated = 0;
    for (const row of rows) {
      if (!row.code || !row.name) continue;
      const existing = pnList.find((p) => p.code === row.code);
      try {
        if (existing) {
          await api.patch(`/master/prioritas-nasional/${existing.id}`, row);
          updated++;
        } else {
          await api.post("/master/prioritas-nasional", row);
          created++;
        }
      } catch {
        // dilewati
      }
    }
    toast.success(`Import PN selesai: ${created} ditambah, ${updated} diperbarui`);
    fetchAll();
  };
  const onImportPp = async (rows: Record<string, string>[]) => {
    let created = 0,
      updated = 0,
      dilewati = 0;
    for (const row of rows) {
      const induk = pnList.find((p) => p.code === row.kodePn);
      if (!row.code || !row.name || !induk) {
        dilewati++;
        continue;
      }
      const payload = {
        code: row.code,
        name: row.name,
        prioritasNasionalId: induk.id,
      };
      const existing = ppList.find((p) => p.code === row.code);
      try {
        if (existing) {
          await api.patch(`/master/program-prioritas/${existing.id}`, payload);
          updated++;
        } else {
          await api.post("/master/program-prioritas", payload);
          created++;
        }
      } catch {
        dilewati++;
      }
    }
    toast.success(
      `Import PP selesai: ${created} ditambah, ${updated} diperbarui` +
        (dilewati ? `, ${dilewati} dilewati (kode PN tidak cocok)` : ""),
    );
    fetchAll();
  };
  const onImportKp = async (rows: Record<string, string>[]) => {
    let created = 0,
      updated = 0,
      dilewati = 0;
    for (const row of rows) {
      const induk = ppList.find((p) => p.code === row.kodePp);
      if (!row.code || !row.name || !induk) {
        dilewati++;
        continue;
      }
      const payload = {
        code: row.code,
        name: row.name,
        programPrioritasId: induk.id,
      };
      const existing = kpList.find((k) => k.code === row.code);
      try {
        if (existing) {
          await api.patch(`/master/kegiatan-prioritas/${existing.id}`, payload);
          updated++;
        } else {
          await api.post("/master/kegiatan-prioritas", payload);
          created++;
        }
      } catch {
        dilewati++;
      }
    }
    toast.success(
      `Import KP selesai: ${created} ditambah, ${updated} diperbarui` +
        (dilewati ? `, ${dilewati} dilewati (kode PP tidak cocok)` : ""),
    );
    fetchAll();
  };

  // ===== Toolbar Import/Export — sekarang PN/PP/KP dirender sebagai 1 tree,
  // bukan 3 MasterTable, jadi Import/Export ditulis ulang ringkas per level. =====
  const exportExcel = (
    filename: string,
    sheet: string,
    rows: Record<string, any>[],
  ) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows.length ? rows : [{}]),
      sheet,
    );
    XLSX.writeFile(wb, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const exportPn = () =>
    exportExcel(
      "pn",
      "PN",
      pnList.map((p) => ({ Kode: p.code, Nama: p.name })),
    );
  const exportPp = () =>
    exportExcel(
      "pp",
      "PP",
      ppList.map((p) => ({
        "Kode PN": p.prioritasNasional?.code ?? "",
        Kode: p.code,
        Nama: p.name,
      })),
    );
  const exportKp = () =>
    exportExcel(
      "kp",
      "KP",
      kpList.map((k) => ({
        "Kode PP": k.programPrioritas?.code ?? "",
        Kode: k.code,
        Nama: k.name,
      })),
    );

  const pnFileRef = useRef<HTMLInputElement>(null);
  const ppFileRef = useRef<HTMLInputElement>(null);
  const kpFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState<"pn" | "pp" | "kp" | null>(null);

  const readExcelRows = async (
    file: File,
    labelToKey: Record<string, string>,
  ) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
    return raw.map((r) =>
      Object.fromEntries(
        Object.entries(r)
          .filter(([label]) => labelToKey[label])
          .map(([label, v]) => [labelToKey[label], String(v ?? "").trim()]),
      ),
    );
  };
  const handleImportFile =
    (level: "pn" | "pp" | "kp") => async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setImporting(level);
      try {
        if (level === "pn") {
          await onImportPn(await readExcelRows(file, { Kode: "code", Nama: "name" }));
        } else if (level === "pp") {
          await onImportPp(
            await readExcelRows(file, {
              "Kode PN": "kodePn",
              Kode: "code",
              Nama: "name",
            }),
          );
        } else {
          await onImportKp(
            await readExcelRows(file, {
              "Kode PP": "kodePp",
              Kode: "code",
              Nama: "name",
            }),
          );
        }
      } catch (err: any) {
        toast.error(err.message || "Gagal impor file");
      } finally {
        setImporting(null);
      }
    };

  const ImportExportButtons = ({
    level,
    fileRef,
    onExport,
  }: {
    level: "pn" | "pp" | "kp";
    fileRef: React.RefObject<HTMLInputElement | null>;
    onExport: () => void;
  }) => (
    <div className="flex items-center gap-1.5">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleImportFile(level)}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={importing === level}
        onClick={() => fileRef.current?.click()}
      >
        {importing === level ? (
          <Loader2 size={12} className="mr-1 animate-spin" />
        ) : (
          <Upload size={12} className="mr-1" />
        )}
        Import
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onExport}>
        <Download size={12} className="mr-1" /> Export
      </Button>
    </div>
  );

  const ppByPn = new Map<string, PP[]>();
  for (const p of ppList) {
    ppByPn.set(p.prioritasNasionalId, [
      ...(ppByPn.get(p.prioritasNasionalId) ?? []),
      p,
    ]);
  }
  const kpByPp = new Map<string, KP[]>();
  for (const k of kpList) {
    kpByPp.set(k.programPrioritasId, [...(kpByPp.get(k.programPrioritasId) ?? []), k]);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Prioritas Nasional (PN / PP / KP)</h3>
        <p className="text-xs text-muted-foreground">
          Expand PN untuk lihat PP-nya, expand PP untuk lihat KP-nya.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground w-8">
            PN
          </span>
          <ImportExportButtons level="pn" fileRef={pnFileRef} onExport={exportPn} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground w-8">
            PP
          </span>
          <ImportExportButtons level="pp" fileRef={ppFileRef} onExport={exportPp} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground w-8">
            KP
          </span>
          <ImportExportButtons level="kp" fileRef={kpFileRef} onExport={exportKp} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ) : pnList.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">
              Belum ada data
            </p>
          ) : (
            <div className="divide-y">
              {[...pnList]
                .sort((a, b) => a.code.localeCompare(b.code, "id", { numeric: true }))
                .map((p) => {
                  const pnOpen = expanded.has(p.id);
                  const ppChildren = (ppByPn.get(p.id) ?? []).sort((a, b) =>
                    a.code.localeCompare(b.code, "id", { numeric: true }),
                  );
                  return (
                    <div key={p.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggle(p.id)}
                        className="group flex items-center gap-2 px-3.5 py-2.5 cursor-pointer hover:bg-accent/30"
                      >
                        {pnOpen ? (
                          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                        )}
                        <span className="font-mono text-[10px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded shrink-0">
                          {p.code}
                        </span>
                        <span className="text-sm font-medium flex-1 truncate">
                          {p.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {ppChildren.length} PP
                        </span>
                        <TooltipProvider delayDuration={300}>
                          <div
                            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openPn(p)}>
                                  <Pencil size={12} />
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
                                  onClick={() => deletePn(p.id)}
                                >
                                  <Trash2 size={12} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Hapus</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </div>

                      {pnOpen && (
                        <div className="bg-muted/10 border-t divide-y">
                          {ppChildren.map((pp) => {
                            const ppOpen = expanded.has(pp.id);
                            const kpChildren = (kpByPp.get(pp.id) ?? []).sort((a, b) =>
                              a.code.localeCompare(b.code, "id", { numeric: true }),
                            );
                            return (
                              <div key={pp.id}>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => toggle(pp.id)}
                                  className="group flex items-center gap-2 pl-9 pr-3.5 py-2 cursor-pointer hover:bg-accent/30"
                                >
                                  {ppOpen ? (
                                    <ChevronDown size={13} className="text-muted-foreground shrink-0" />
                                  ) : (
                                    <ChevronRight size={13} className="text-muted-foreground shrink-0" />
                                  )}
                                  <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded shrink-0">
                                    {pp.code}
                                  </span>
                                  <span className="text-[13px] font-medium flex-1 truncate">
                                    {pp.name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {kpChildren.length} KP
                                  </span>
                                  <TooltipProvider delayDuration={300}>
                                    <div
                                      className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openPp(pp)}>
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
                                            onClick={() => deletePp(pp.id)}
                                          >
                                            <Trash2 size={11} />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Hapus</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TooltipProvider>
                                </div>

                                {ppOpen && (
                                  <div className="bg-muted/20 border-t divide-y">
                                    {kpChildren.map((k) => (
                                      <div
                                        key={k.id}
                                        className="group flex items-center gap-2 pl-16 pr-3.5 py-1.5"
                                      >
                                        <span className="font-mono text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded shrink-0">
                                          {k.code}
                                        </span>
                                        <span className="text-[12px] flex-1 truncate">
                                          {k.name}
                                        </span>
                                        <TooltipProvider delayDuration={300}>
                                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openKp(k)}>
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
                                                  onClick={() => deleteKp(k.id)}
                                                >
                                                  <Trash2 size={11} />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>Hapus</TooltipContent>
                                            </Tooltip>
                                          </div>
                                        </TooltipProvider>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => openKp("new", pp.id)}
                                      className="w-full flex items-center gap-1.5 pl-16 pr-3.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                                    >
                                      <Plus size={11} /> KP
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => openPp("new", p.id)}
                            className="w-full flex items-center gap-1.5 pl-9 pr-3.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                          >
                            <Plus size={12} /> PP
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      <button
        type="button"
        onClick={() => openPn("new")}
        className="flex items-center gap-1.5 px-3.5 py-2 text-xs text-muted-foreground hover:text-foreground border border-dashed rounded-lg hover:bg-accent/40 transition-colors"
      >
        <Plus size={13} /> PN
      </button>

      {/* Form PN */}
      <Dialog open={!!pnForm} onOpenChange={(v) => !v && setPnForm(null)}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{pnForm === "new" ? "Tambah PN" : "Edit PN"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={pn.handleSubmit(submitPn)} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                Kode <span className="text-destructive">*</span>
              </Label>
              <Input className="h-10" placeholder="02" {...pn.register("code")} />
            </div>
            <div className="space-y-2">
              <Label>
                Nama <span className="text-destructive">*</span>
              </Label>
              <Input className="h-10" {...pn.register("name")} />
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setPnForm(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={pn.formState.isSubmitting}>
                {pn.formState.isSubmitting && (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Form PP */}
      <Dialog open={!!ppForm} onOpenChange={(v) => !v && setPpForm(null)}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{ppForm === "new" ? "Tambah PP" : "Edit PP"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={pp.handleSubmit(submitPp)} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                PN Induk <span className="text-destructive">*</span>
              </Label>
              <Select
                value={pp.watch("prioritasNasionalId")}
                onValueChange={(v) => pp.setValue("prioritasNasionalId", v)}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Pilih PN" />
                </SelectTrigger>
                <SelectContent>
                  {pnList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Kode <span className="text-destructive">*</span>
              </Label>
              <Input className="h-10" placeholder="02.12" {...pp.register("code")} />
            </div>
            <div className="space-y-2">
              <Label>
                Nama <span className="text-destructive">*</span>
              </Label>
              <Input className="h-10" {...pp.register("name")} />
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setPpForm(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={pp.formState.isSubmitting}>
                {pp.formState.isSubmitting && (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Form KP */}
      <Dialog open={!!kpForm} onOpenChange={(v) => !v && setKpForm(null)}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{kpForm === "new" ? "Tambah KP" : "Edit KP"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={kp.handleSubmit(submitKp)} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                PP Induk <span className="text-destructive">*</span>
              </Label>
              <Select
                value={kp.watch("programPrioritasId")}
                onValueChange={(v) => kp.setValue("programPrioritasId", v)}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Pilih PP" />
                </SelectTrigger>
                <SelectContent>
                  {ppList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Kode <span className="text-destructive">*</span>
              </Label>
              <Input className="h-10" placeholder="02.12.01" {...kp.register("code")} />
            </div>
            <div className="space-y-2">
              <Label>
                Nama <span className="text-destructive">*</span>
              </Label>
              <Input className="h-10" {...kp.register("name")} />
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setKpForm(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={kp.formState.isSubmitting}>
                {kp.formState.isSubmitting && (
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
