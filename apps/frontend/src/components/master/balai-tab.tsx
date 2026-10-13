"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MasterTable } from "./master-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";

interface Balai {
  id: number;
  name: string;
  shortName?: string;
  code?: string;
  isActive: boolean;
  kegiatanId?: string | null;
  kegiatan?: { id: string; code: string; name: string } | null;
}

const schema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Nama wajib diisi"),
  // null dari data lama (singkatan/kode kosong) jangan bikin form gagal simpan.
  shortName: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  kegiatanId: z.string().nullable().optional(),
});

type FormData = z.infer<typeof schema>;

interface Satker {
  id: string;
  name: string;
  balaiId: number;
}
// Dialog satker: tambah (banyak baris sekaligus) atau ubah nama 1 satker.
type FormSatker = { balai: Balai; id?: string; nama: string[] };

export function BalaiTab() {
  const [data, setData] = useState<Balai[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Balai | null>(null);
  const [kegiatan, setKegiatan] = useState<{ id: string; code: string; name: string }[]>([]);
  const [satker, setSatker] = useState<Satker[]>([]);
  const [formSatker, setFormSatker] = useState<FormSatker | null>(null);
  const [savingSatker, setSavingSatker] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get("/master/balai");
      setData(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memuat data Balai");
    } finally {
      setLoading(false);
    }
  };

  const fetchSatker = () =>
    api
      .get("/master/satker")
      .then((r) => setSatker(r.data))
      .catch(() => toast.error("Gagal memuat data Satker"));

  // Simpan semua baris; nama kosong & yang sudah ada di balai ini dilewati.
  const simpanSatker = async () => {
    if (!formSatker) return;
    const { balai, id } = formSatker;
    const ada = new Set(
      satker.filter((x) => x.balaiId === balai.id && x.id !== id).map((x) => x.name.toLowerCase()),
    );
    const nama = [...new Set(formSatker.nama.map((n) => n.trim()).filter(Boolean))];
    const baru = nama.filter((n) => !ada.has(n.toLowerCase()));
    if (!nama.length) return toast.error("Isi nama satker");
    if (!baru.length) return toast.error("Satker itu sudah ada di balai ini");
    setSavingSatker(true);
    try {
      if (id) await api.patch(`/master/satker/${id}`, { balaiId: balai.id, name: baru[0] });
      else for (const name of baru) await api.post("/master/satker", { balaiId: balai.id, name });
      const lewat = nama.length - baru.length;
      toast.success(
        id ? "Satker diperbarui" : `${baru.length} satker ditambahkan${lewat ? `, ${lewat} sudah ada` : ""}`,
      );
      setFormSatker(null);
      fetchSatker();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan satker");
    } finally {
      setSavingSatker(false);
    }
  };
  const hapusSatker = async (x: Satker) => {
    if (!window.confirm(`Hapus satker "${x.name}"?`)) return;
    try {
      await api.delete(`/master/satker/${x.id}`);
      toast.success("Satker dihapus");
      fetchSatker();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus satker");
    }
  };

  useEffect(() => {
    fetch();
    fetchSatker();
    api.get("/master/kegiatan").then((r) => setKegiatan(r.data)).catch(() => {});
  }, []);

  const openAdd = () => {
    setEditData(null);
    reset({ isActive: true });
    setShowForm(true);
  };
  const openEdit = (item: Balai) => {
    setEditData(item);
    reset({ ...item, kegiatanId: item.kegiatanId ?? null });
    setShowForm(true);
  };

  const onSubmit = async (data: FormData) => {
    try {
      if (editData) {
        await api.patch(`/master/balai/${editData.id}`, data);
        toast.success("Balai berhasil diperbarui");
      } else {
        await api.post("/master/balai", data);
        toast.success("Balai berhasil ditambahkan");
      }
      setShowForm(false);
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };

  const onDelete = async (id: string | number) => {
    try {
      await api.delete(`/master/balai/${id}`);
      toast.success("Balai berhasil dihapus");
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  const onBulkDelete = async (ids: (string | number)[]) => {
    try {
      const res = await api.post("/master/balai/bulk-delete", { ids });
      toast.success(res.data?.message || "Balai terpilih berhasil dihapus");
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  // Import: baris dicocokkan ke balai yang sudah ada lewat "id" (kode
  // numerik balai, manual) — kalau ketemu di-update, kalau tidak dibuat
  // baru. Baris tanpa id yang valid dilewati (bukan error, biar sisanya
  // tetap masuk).
  const onImportRows = async (rows: Record<string, string>[]) => {
    let created = 0;
    let updated = 0;
    let dilewati = 0;
    for (const row of rows) {
      const id = Number(row.id);
      if (!id) {
        dilewati++;
        continue;
      }
      const payload = {
        name: row.name,
        shortName: row.shortName || undefined,
        code: row.code || undefined,
        isActive: !/^(tidak|nonaktif|0|false)$/i.test(row.isActive || ""),
      };
      try {
        if (data.some((b) => b.id === id)) {
          await api.patch(`/master/balai/${id}`, payload);
          updated++;
        } else {
          await api.post("/master/balai", { id, ...payload });
          created++;
        }
      } catch {
        dilewati++;
      }
    }
    toast.success(
      `Import selesai: ${created} ditambah, ${updated} diperbarui` +
        (dilewati ? `, ${dilewati} dilewati` : ""),
    );
    fetch();
  };

  return (
    <div className="space-y-8">
      <MasterTable
        title="Balai"
        data={data}
        loading={loading}
        columns={[
          { key: "id", label: "ID" },
          { key: "name", label: "Nama Balai" },
          { key: "shortName", label: "Singkatan" },
          { key: "code", label: "Kode" },
          {
            key: "kegiatanId",
            label: "Kegiatan",
            render: (item) => item.kegiatan?.code ?? "—",
            exportValue: (item) => item.kegiatan?.code ?? "",
          },
          {
            key: "satker",
            label: "Satker",
            render: (item) => satker.filter((x) => x.balaiId === item.id).length || "—",
            exportValue: (item) =>
              satker.filter((x) => x.balaiId === item.id).map((x) => x.name).join("; "),
            skipImport: true,
          },
          {
            key: "isActive",
            label: "Status",
            render: (item) =>
              item.isActive ? (
                <Badge variant="outline" className="text-[10px]">
                  Aktif
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] text-destructive border-destructive/40"
                >
                  Nonaktif
                </Badge>
              ),
            exportValue: (item) => (item.isActive ? "Ya" : "Tidak"),
          },
        ]}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={onDelete}
        onBulkDelete={onBulkDelete}
        onImport={onImportRows}
        exportable
        searchKeys={["name", "shortName", "code"]}
        renderExpanded={(item) => {
          const daftar = satker.filter((x) => x.balaiId === item.id);
          return (
            <div className="space-y-2">
              {daftar.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada satker.</p>
              ) : (
                <ul className="divide-y rounded-lg border bg-background">
                  {daftar.map((x) => (
                    <li key={x.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                      <span className="flex-1">{x.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Ubah satker ${x.name}`}
                        onClick={() => setFormSatker({ balai: item, id: x.id, nama: [x.name] })}
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Hapus satker ${x.name}`}
                        onClick={() => hapusSatker(x)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFormSatker({ balai: item, nama: [""] })}
              >
                <Plus size={13} className="mr-1.5" /> Tambah satker
              </Button>
            </div>
          );
        }}
      />

      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent
          className="!max-w-xl !w-[85vw]"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editData ? "Edit Balai" : "Tambah Balai"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="min-w-0 space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              {!editData && (
                <div className="space-y-2">
                  <Label>
                    ID Balai <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="h-10"
                    type="number"
                    placeholder="1"
                    {...register("id", { valueAsNumber: true })}
                  />
                </div>
              )}
              <div className={`space-y-2 ${editData ? "col-span-2" : ""}`}>
                <Label>Kode</Label>
                <Input
                  className="h-10"
                  placeholder="BS1"
                  {...register("code")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Nama Balai <span className="text-destructive">*</span>
              </Label>
              <Input
                className="h-10"
                placeholder="Balai Wilayah Sungai..."
                {...register("name")}
              />
              {errors.name && (
                <p className="text-destructive text-xs">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Singkatan</Label>
              <Input
                className="h-10"
                placeholder="BWSS1"
                {...register("shortName")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balai-kegiatan">Kegiatan</Label>
              <Select
                value={watch("kegiatanId") ?? "__none__"}
                onValueChange={(v) => setValue("kegiatanId", v === "__none__" ? null : v)}
              >
                <SelectTrigger
                  id="balai-kegiatan"
                  className="h-10 w-full min-w-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate"
                >
                  <SelectValue placeholder="Pilih kegiatan" />
                </SelectTrigger>
                <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="__none__">— Belum ditentukan —</SelectItem>
                  {kegiatan.map((k) => (
                    <SelectItem
                      key={k.id}
                      value={k.id}
                      className="w-full *:data-[slot=select-item-text]:whitespace-normal"
                    >
                      {k.code} · {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Akun Balai &amp; Satker di balai ini otomatis memakai form kegiatan ini.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                {...register("isActive")}
              />
              Balai aktif (boleh membuat paket)
            </label>
            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                )}
                {editData ? "Simpan" : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Satker di bawah Balai — dipakai dropdown satker per paket. */}
      <Dialog open={!!formSatker} onOpenChange={(v) => !v && setFormSatker(null)}>
        <DialogContent className="!max-w-lg !w-[85vw]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{formSatker?.id ? "Ubah satker" : "Tambah satker"}</DialogTitle>
            <p className="text-sm text-muted-foreground">{formSatker?.balai.name}</p>
          </DialogHeader>
          {formSatker && (
            <div className="space-y-2 py-1">
              {formSatker.nama.map((n, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    autoFocus={i === formSatker.nama.length - 1}
                    aria-label={`Nama satker ${i + 1}`}
                    className="h-10"
                    placeholder="SNVT Pelaksanaan Jaringan Pemanfaatan Air"
                    value={n}
                    onChange={(e) =>
                      setFormSatker({
                        ...formSatker,
                        nama: formSatker.nama.map((x, j) => (j === i ? e.target.value : x)),
                      })
                    }
                  />
                  {formSatker.nama.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      aria-label="Hapus baris"
                      onClick={() =>
                        setFormSatker({ ...formSatker, nama: formSatker.nama.filter((_, j) => j !== i) })
                      }
                    >
                      <X size={14} />
                    </Button>
                  )}
                </div>
              ))}
              {!formSatker.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFormSatker({ ...formSatker, nama: [...formSatker.nama, ""] })}
                >
                  <Plus size={13} className="mr-1.5" /> Tambah
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormSatker(null)}>
              Batal
            </Button>
            <Button onClick={simpanSatker} disabled={savingSatker}>
              {savingSatker && <Loader2 size={14} className="mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
