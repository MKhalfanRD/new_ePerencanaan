"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MasterTable } from "./master-table";
import api from "@/lib/api";

interface Item {
  id: string;
  name: string;
  code?: string | null;
}

type FormData = { name: string; code: string };

// Kolom `code` @unique — string kosong harus jadi null supaya tidak bentrok.
const toPayload = (d: { name: string; code?: string }) => ({
  name: d.name.trim(),
  code: d.code?.trim() || null,
});

export function WilayahSungaiTab() {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Item | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get("/master/wilayah-sungai");
      setData(res.data);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Gagal memuat data Wilayah Sungai",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  const openAdd = () => {
    setEditData(null);
    reset({ name: "", code: "" });
    setShowForm(true);
  };
  const openEdit = (item: Item) => {
    setEditData(item);
    reset({ name: item.name, code: item.code ?? "" });
    setShowForm(true);
  };

  const onSubmit = async (data: FormData) => {
    try {
      if (editData) {
        await api.patch(`/master/wilayah-sungai/${editData.id}`, toPayload(data));
        toast.success("Wilayah Sungai berhasil diperbarui");
      } else {
        await api.post("/master/wilayah-sungai", toPayload(data));
        toast.success("Wilayah Sungai berhasil ditambahkan");
      }
      setShowForm(false);
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };

  const onDelete = async (id: string | number) => {
    try {
      await api.delete(`/master/wilayah-sungai/${id}`);
      toast.success("Wilayah Sungai berhasil dihapus");
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  const onBulkDelete = async (ids: (string | number)[]) => {
    try {
      const res = await api.post("/master/wilayah-sungai/bulk-delete", { ids });
      toast.success(res.data?.message || "Data terpilih berhasil dihapus");
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  // Import: id-nya cuid (bukan sesuatu yang diketik user), jadi baris
  // dicocokkan ke data yang sudah ada lewat nama (case-insensitive) —
  // ketemu di-update, tidak ketemu dibuat baru.
  const onImportRows = async (rows: Record<string, string>[]) => {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const name = row.name?.trim();
      if (!name) continue;
      const existing = data.find(
        (d) => d.name.toLowerCase() === name.toLowerCase(),
      );
      try {
        const payload = toPayload({ name, code: row.code });
        if (existing) {
          await api.patch(`/master/wilayah-sungai/${existing.id}`, payload);
          updated++;
        } else {
          await api.post("/master/wilayah-sungai", payload);
          created++;
        }
      } catch {
        // dilewati, lanjut baris berikutnya
      }
    }
    toast.success(`Import selesai: ${created} ditambah, ${updated} diperbarui`);
    fetch();
  };

  return (
    <>
      <MasterTable
        title="Wilayah Sungai"
        data={data}
        loading={loading}
        columns={[
          { key: "code", label: "Kode" },
          { key: "name", label: "Nama" },
        ]}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={onDelete}
        onBulkDelete={onBulkDelete}
        onImport={onImportRows}
        exportable
        searchKeys={["code", "name"]}
      />

      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent
          className="!max-w-lg !w-[80vw]"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editData ? "Edit Wilayah Sungai" : "Tambah Wilayah Sungai"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Kode</Label>
              <Input
                className="h-10"
                placeholder="Contoh: 01.01.A3"
                {...register("code")}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Nama <span className="text-destructive">*</span>
              </Label>
              <Input
                className="h-10"
                placeholder="Nama Wilayah Sungai"
                {...register("name", { required: true })}
              />
            </div>
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
