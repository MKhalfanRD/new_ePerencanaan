"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as XLSX from "xlsx";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  Plus,
  Trash2,
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
 * Master Sasaran Program (SP + Indikator/ISP, anak Program) & Sasaran
 * Kegiatan (SK + Indikator/ISK, anak Kegiatan) — dari referensi 1.xlsx.
 * Satu Program/Kegiatan bisa punya beberapa SP/SK.
 */

interface Program {
  id: string;
  code: string;
  name: string;
}
interface Kegiatan {
  id: string;
  code: string;
  name: string;
}
interface SP {
  id: string;
  programId: string;
  program?: Program;
  name: string;
}
interface ISP {
  id: string;
  sasaranProgramId: string;
  name: string;
  satuan?: string;
}
interface SK {
  id: string;
  kegiatanId: string;
  kegiatan?: Kegiatan;
  name: string;
}
interface ISK {
  id: string;
  sasaranKegiatanId: string;
  name: string;
  satuan?: string;
}

export function SasaranTab() {
  const [programList, setProgramList] = useState<Program[]>([]);
  const [kegiatanList, setKegiatanList] = useState<Kegiatan[]>([]);
  const [spList, setSpList] = useState<(SP & { indikator: ISP[] })[]>([]);
  const [skList, setSkList] = useState<(SK & { indikator: ISK[] })[]>([]);
  const [loading, setLoading] = useState(true);

  const [spForm, setSpForm] = useState<SP | "new" | null>(null);
  const [ispForm, setIspForm] = useState<
    (ISP & { sasaranProgram: SP }) | "new" | null
  >(null);
  const [skForm, setSkForm] = useState<SK | "new" | null>(null);
  const [iskForm, setIskForm] = useState<
    (ISK & { sasaranKegiatan: SK }) | "new" | null
  >(null);

  // Expand/collapse SP/SK — kunci pakai id apa adanya (cuid unik).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const spFormHook = useForm<{ programId: string; name: string }>();
  const ispFormHook = useForm<{
    sasaranProgramId: string;
    name: string;
    satuan: string;
  }>();
  const skFormHook = useForm<{ kegiatanId: string; name: string }>();
  const iskFormHook = useForm<{
    sasaranKegiatanId: string;
    name: string;
    satuan: string;
  }>();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [prog, keg, sp, sk] = await Promise.all([
        api.get("/master/programs"),
        api.get("/master/kegiatan"),
        api.get("/master/sasaran-program"),
        api.get("/master/sasaran-kegiatan"),
      ]);
      setProgramList(prog.data);
      setKegiatanList(keg.data);
      setSpList(sp.data);
      setSkList(sk.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memuat data Sasaran");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // ===== SP =====
  const openSp = (item: SP | "new", parentProgramId?: string) => {
    setSpForm(item);
    spFormHook.reset(
      item === "new"
        ? { programId: parentProgramId ?? "", name: "" }
        : { programId: item.programId, name: item.name },
    );
  };
  const submitSp = async (data: { programId: string; name: string }) => {
    try {
      if (spForm !== "new" && spForm) {
        await api.patch(`/master/sasaran-program/${spForm.id}`, data);
        toast.success("SP diperbarui");
      } else {
        await api.post("/master/sasaran-program", data);
        toast.success("SP ditambahkan");
      }
      setSpForm(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };
  const deleteSp = async (id: string | number) => {
    try {
      await api.delete(`/master/sasaran-program/${id}`);
      toast.success("SP dihapus");
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  // ===== ISP =====
  const openIsp = (
    item: (ISP & { sasaranProgram: SP }) | "new",
    parentSpId?: string,
  ) => {
    setIspForm(item);
    ispFormHook.reset(
      item === "new"
        ? { sasaranProgramId: parentSpId ?? "", name: "", satuan: "" }
        : {
            sasaranProgramId: item.sasaranProgramId,
            name: item.name,
            satuan: item.satuan || "",
          },
    );
  };
  const submitIsp = async (data: {
    sasaranProgramId: string;
    name: string;
    satuan: string;
  }) => {
    try {
      if (ispForm !== "new" && ispForm) {
        await api.patch(`/master/sasaran-program/indikator/${ispForm.id}`, data);
        toast.success("ISP diperbarui");
      } else {
        await api.post("/master/sasaran-program/indikator", data);
        toast.success("ISP ditambahkan");
      }
      setIspForm(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };
  const deleteIsp = async (id: string | number) => {
    try {
      await api.delete(`/master/sasaran-program/indikator/${id}`);
      toast.success("ISP dihapus");
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  // ===== SK =====
  const openSk = (item: SK | "new", parentKegiatanId?: string) => {
    setSkForm(item);
    skFormHook.reset(
      item === "new"
        ? { kegiatanId: parentKegiatanId ?? "", name: "" }
        : { kegiatanId: item.kegiatanId, name: item.name },
    );
  };
  const submitSk = async (data: { kegiatanId: string; name: string }) => {
    try {
      if (skForm !== "new" && skForm) {
        await api.patch(`/master/sasaran-kegiatan/${skForm.id}`, data);
        toast.success("SK diperbarui");
      } else {
        await api.post("/master/sasaran-kegiatan", data);
        toast.success("SK ditambahkan");
      }
      setSkForm(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };
  const deleteSk = async (id: string | number) => {
    try {
      await api.delete(`/master/sasaran-kegiatan/${id}`);
      toast.success("SK dihapus");
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  // ===== ISK =====
  const openIsk = (
    item: (ISK & { sasaranKegiatan: SK }) | "new",
    parentSkId?: string,
  ) => {
    setIskForm(item);
    iskFormHook.reset(
      item === "new"
        ? { sasaranKegiatanId: parentSkId ?? "", name: "", satuan: "" }
        : {
            sasaranKegiatanId: item.sasaranKegiatanId,
            name: item.name,
            satuan: item.satuan || "",
          },
    );
  };
  const submitIsk = async (data: {
    sasaranKegiatanId: string;
    name: string;
    satuan: string;
  }) => {
    try {
      if (iskForm !== "new" && iskForm) {
        await api.patch(`/master/sasaran-kegiatan/indikator/${iskForm.id}`, data);
        toast.success("ISK diperbarui");
      } else {
        await api.post("/master/sasaran-kegiatan/indikator", data);
        toast.success("ISK ditambahkan");
      }
      setIskForm(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };
  const deleteIsk = async (id: string | number) => {
    try {
      await api.delete(`/master/sasaran-kegiatan/indikator/${id}`);
      toast.success("ISK dihapus");
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  // Export — SP/SK sekarang dirender sebagai tree per Program/Kegiatan,
  // bukan MasterTable, jadi export ditulis ulang ringkas di sini. Import
  // sengaja tidak ditambahkan (lihat catatan di plan: tidak ada kolom kode
  // alami buat SP/SK untuk dicocokkan saat upsert).
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
  const exportSpSide = () =>
    exportExcel(
      "sasaran-program",
      "SP-ISP",
      spList.flatMap((sp) =>
        sp.indikator.length
          ? sp.indikator.map((i) => ({
              "Kode Program": sp.program?.code ?? "",
              "Nama SP": sp.name,
              "Nama ISP": i.name,
              Satuan: i.satuan ?? "",
            }))
          : [
              {
                "Kode Program": sp.program?.code ?? "",
                "Nama SP": sp.name,
                "Nama ISP": "",
                Satuan: "",
              },
            ],
      ),
    );
  const exportSkSide = () =>
    exportExcel(
      "sasaran-kegiatan",
      "SK-ISK",
      skList.flatMap((sk) =>
        sk.indikator.length
          ? sk.indikator.map((i) => ({
              "Kode Kegiatan": sk.kegiatan?.code ?? "",
              "Nama SK": sk.name,
              "Nama ISK": i.name,
              Satuan: i.satuan ?? "",
            }))
          : [
              {
                "Kode Kegiatan": sk.kegiatan?.code ?? "",
                "Nama SK": sk.name,
                "Nama ISK": "",
                Satuan: "",
              },
            ],
      ),
    );

  const spByProgram = new Map<string, (SP & { indikator: ISP[] })[]>();
  for (const sp of spList) {
    spByProgram.set(sp.programId, [...(spByProgram.get(sp.programId) ?? []), sp]);
  }
  const skByKegiatan = new Map<string, (SK & { indikator: ISK[] })[]>();
  for (const sk of skList) {
    skByKegiatan.set(sk.kegiatanId, [...(skByKegiatan.get(sk.kegiatanId) ?? []), sk]);
  }

  return (
    <div className="space-y-8">
      {/* ===== Sasaran Program (SP) — dikelompokkan per Program ===== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Sasaran Program (SP / ISP)</h3>
          </div>
          <Button size="sm" variant="outline" onClick={exportSpSide}>
            <Download size={14} className="mr-1.5" /> Export Excel
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ) : (
              <div className="divide-y">
                {programList.map((prog) => {
                  const spChildren = spByProgram.get(prog.id) ?? [];
                  return (
                    <div key={prog.id} className="py-2">
                      <div className="flex items-center gap-2 px-3.5 py-1">
                        <span className="font-mono text-[10px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded shrink-0">
                          {prog.code}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground truncate">
                          {prog.name}
                        </span>
                      </div>
                      <div className="divide-y">
                        {spChildren.map((sp) => {
                          const spOpen = expanded.has(sp.id);
                          return (
                            <div key={sp.id}>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => toggle(sp.id)}
                                className="group flex items-center gap-2 pl-9 pr-3.5 py-2 cursor-pointer hover:bg-accent/30"
                              >
                                {spOpen ? (
                                  <ChevronDown size={13} className="text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronRight size={13} className="text-muted-foreground shrink-0" />
                                )}
                                <span className="text-[13px] font-medium flex-1 truncate">
                                  {sp.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {sp.indikator.length} ISP
                                </span>
                                <TooltipProvider delayDuration={300}>
                                  <div
                                    className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openSp(sp)}>
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
                                          onClick={() => deleteSp(sp.id)}
                                        >
                                          <Trash2 size={11} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Hapus</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TooltipProvider>
                              </div>
                              {spOpen && (
                                <div className="bg-muted/10 border-t divide-y">
                                  {sp.indikator.map((i) => (
                                    <div key={i.id} className="group flex items-center gap-2 pl-16 pr-3.5 py-1.5">
                                      <span className="text-[12px] flex-1 truncate">{i.name}</span>
                                      {i.satuan && (
                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                          {i.satuan}
                                        </span>
                                      )}
                                      <TooltipProvider delayDuration={300}>
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => openIsp({ ...i, sasaranProgram: sp })}
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
                                                onClick={() => deleteIsp(i.id)}
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
                                    onClick={() => openIsp("new", sp.id)}
                                    className="w-full flex items-center gap-1.5 pl-16 pr-3.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                                  >
                                    <Plus size={11} /> ISP
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => openSp("new", prog.id)}
                          className="w-full flex items-center gap-1.5 pl-9 pr-3.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                        >
                          <Plus size={12} /> SP
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Sasaran Kegiatan (SK) — dikelompokkan per Kegiatan ===== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Sasaran Kegiatan (SK / ISK)</h3>
          </div>
          <Button size="sm" variant="outline" onClick={exportSkSide}>
            <Download size={14} className="mr-1.5" /> Export Excel
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ) : (
              <div className="divide-y">
                {kegiatanList.map((keg) => {
                  const skChildren = skByKegiatan.get(keg.id) ?? [];
                  return (
                    <div key={keg.id} className="py-2">
                      <div className="flex items-center gap-2 px-3.5 py-1">
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded shrink-0">
                          {keg.code}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground truncate">
                          {keg.name}
                        </span>
                      </div>
                      <div className="divide-y">
                        {skChildren.map((sk) => {
                          const skOpen = expanded.has(sk.id);
                          return (
                            <div key={sk.id}>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => toggle(sk.id)}
                                className="group flex items-center gap-2 pl-9 pr-3.5 py-2 cursor-pointer hover:bg-accent/30"
                              >
                                {skOpen ? (
                                  <ChevronDown size={13} className="text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronRight size={13} className="text-muted-foreground shrink-0" />
                                )}
                                <span className="text-[13px] font-medium flex-1 truncate">
                                  {sk.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {sk.indikator.length} ISK
                                </span>
                                <TooltipProvider delayDuration={300}>
                                  <div
                                    className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openSk(sk)}>
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
                                          onClick={() => deleteSk(sk.id)}
                                        >
                                          <Trash2 size={11} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Hapus</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TooltipProvider>
                              </div>
                              {skOpen && (
                                <div className="bg-muted/10 border-t divide-y">
                                  {sk.indikator.map((i) => (
                                    <div key={i.id} className="group flex items-center gap-2 pl-16 pr-3.5 py-1.5">
                                      <span className="text-[12px] flex-1 truncate">{i.name}</span>
                                      {i.satuan && (
                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                          {i.satuan}
                                        </span>
                                      )}
                                      <TooltipProvider delayDuration={300}>
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => openIsk({ ...i, sasaranKegiatan: sk })}
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
                                                onClick={() => deleteIsk(i.id)}
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
                                    onClick={() => openIsk("new", sk.id)}
                                    className="w-full flex items-center gap-1.5 pl-16 pr-3.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                                  >
                                    <Plus size={11} /> ISK
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => openSk("new", keg.id)}
                          className="w-full flex items-center gap-1.5 pl-9 pr-3.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                        >
                          <Plus size={12} /> SK
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form SP */}
      <Dialog open={!!spForm} onOpenChange={(v) => !v && setSpForm(null)}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{spForm === "new" ? "Tambah SP" : "Edit SP"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={spFormHook.handleSubmit(submitSp)}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label>
                Program <span className="text-destructive">*</span>
              </Label>
              <Select
                value={spFormHook.watch("programId")}
                onValueChange={(v) => spFormHook.setValue("programId", v)}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Pilih program" />
                </SelectTrigger>
                <SelectContent>
                  {programList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Nama SP <span className="text-destructive">*</span>
              </Label>
              <Input className="h-10" {...spFormHook.register("name")} />
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setSpForm(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={spFormHook.formState.isSubmitting}>
                {spFormHook.formState.isSubmitting && (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Form ISP */}
      <Dialog open={!!ispForm} onOpenChange={(v) => !v && setIspForm(null)}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{ispForm === "new" ? "Tambah ISP" : "Edit ISP"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={ispFormHook.handleSubmit(submitIsp)}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label>
                SP Induk <span className="text-destructive">*</span>
              </Label>
              <Select
                value={ispFormHook.watch("sasaranProgramId")}
                onValueChange={(v) => ispFormHook.setValue("sasaranProgramId", v)}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Pilih SP" />
                </SelectTrigger>
                <SelectContent>
                  {spList.map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>
                      {sp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Nama ISP <span className="text-destructive">*</span>
              </Label>
              <Input className="h-10" {...ispFormHook.register("name")} />
            </div>
            <div className="space-y-2">
              <Label>Satuan</Label>
              <Input className="h-10" {...ispFormHook.register("satuan")} />
            </div>
            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIspForm(null)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={ispFormHook.formState.isSubmitting}>
                {ispFormHook.formState.isSubmitting && (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Form SK */}
      <Dialog open={!!skForm} onOpenChange={(v) => !v && setSkForm(null)}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{skForm === "new" ? "Tambah SK" : "Edit SK"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={skFormHook.handleSubmit(submitSk)}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label>
                Kegiatan <span className="text-destructive">*</span>
              </Label>
              <Select
                value={skFormHook.watch("kegiatanId")}
                onValueChange={(v) => skFormHook.setValue("kegiatanId", v)}
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
            <div className="space-y-2">
              <Label>
                Nama SK <span className="text-destructive">*</span>
              </Label>
              <Input className="h-10" {...skFormHook.register("name")} />
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setSkForm(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={skFormHook.formState.isSubmitting}>
                {skFormHook.formState.isSubmitting && (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Form ISK */}
      <Dialog open={!!iskForm} onOpenChange={(v) => !v && setIskForm(null)}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{iskForm === "new" ? "Tambah ISK" : "Edit ISK"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={iskFormHook.handleSubmit(submitIsk)}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label>
                SK Induk <span className="text-destructive">*</span>
              </Label>
              <Select
                value={iskFormHook.watch("sasaranKegiatanId")}
                onValueChange={(v) => iskFormHook.setValue("sasaranKegiatanId", v)}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Pilih SK" />
                </SelectTrigger>
                <SelectContent>
                  {skList.map((sk) => (
                    <SelectItem key={sk.id} value={sk.id}>
                      {sk.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Nama ISK <span className="text-destructive">*</span>
              </Label>
              <Input className="h-10" {...iskFormHook.register("name")} />
            </div>
            <div className="space-y-2">
              <Label>Satuan</Label>
              <Input className="h-10" {...iskFormHook.register("satuan")} />
            </div>
            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIskForm(null)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={iskFormHook.formState.isSubmitting}>
                {iskFormHook.formState.isSubmitting && (
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
