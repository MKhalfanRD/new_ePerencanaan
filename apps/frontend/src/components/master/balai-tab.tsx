"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import api from "@/lib/api";

interface Balai {
  id: number;
  name: string;
  shortName?: string;
  code?: string;
  isActive: boolean;
}

const schema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Nama wajib diisi"),
  shortName: z.string().optional(),
  code: z.string().optional(),
  isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export function BalaiTab() {
  const [data, setData] = useState<Balai[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Balai | null>(null);

  const {
    register,
    handleSubmit,
    reset,
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

  useEffect(() => {
    fetch();
  }, []);

  const openAdd = () => {
    setEditData(null);
    reset({ isActive: true });
    setShowForm(true);
  };
  const openEdit = (item: Balai) => {
    setEditData(item);
    reset({ ...item });
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
    <>
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
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
    </>
  );
}
