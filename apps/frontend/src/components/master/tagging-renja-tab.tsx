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

/**
 * Master dari sheet "Tagging RENJA" (referensi 1.xlsx): dua daftar datar,
 * PKPN & Tematik RENJA — bukan hierarki, tapi tetap master (bisa berubah
 * tiap siklus RENJA), bukan enum hardcode.
 */
interface Item {
  id: string;
  name: string;
}

function useFlatMaster(endpoint: string, label: string) {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Item | "new" | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<{ name: string }>();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await api.get(endpoint);
      setData(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Gagal memuat data ${label}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openAdd = () => {
    setForm("new");
    reset({ name: "" });
  };
  const openEdit = (item: Item) => {
    setForm(item);
    reset({ name: item.name });
  };
  const submit = async (data: { name: string }) => {
    try {
      if (form !== "new" && form) {
        await api.patch(`${endpoint}/${form.id}`, data);
        toast.success(`${label} diperbarui`);
      } else {
        await api.post(endpoint, data);
        toast.success(`${label} ditambahkan`);
      }
      setForm(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };
  const remove = async (id: string | number) => {
    try {
      await api.delete(`${endpoint}/${id}`);
      toast.success(`${label} dihapus`);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };
  const onImport = async (rows: Record<string, string>[]) => {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const name = row.name?.trim();
      if (!name) continue;
      const existing = data.find((d) => d.name.toLowerCase() === name.toLowerCase());
      try {
        if (existing) {
          await api.patch(`${endpoint}/${existing.id}`, { name });
          updated++;
        } else {
          await api.post(endpoint, { name });
          created++;
        }
      } catch {
        // dilewati
      }
    }
    toast.success(`Import selesai: ${created} ditambah, ${updated} diperbarui`);
    fetchAll();
  };

  return {
    data,
    loading,
    form,
    register,
    handleSubmit,
    formState,
    openAdd,
    openEdit,
    submit,
    remove,
    onImport,
    close: () => setForm(null),
  };
}

function FlatMasterTable({
  title,
  m,
}: {
  title: string;
  m: ReturnType<typeof useFlatMaster>;
}) {
  return (
    <div className="space-y-3">
      <MasterTable
        title={title}
        data={m.data}
        loading={m.loading}
        columns={[{ key: "name", label: "Nama" }]}
        onAdd={m.openAdd}
        onEdit={m.openEdit}
        onDelete={m.remove}
        onImport={m.onImport}
        exportable
        searchKeys={["name"]}
      />
      <Dialog open={!!m.form} onOpenChange={(v) => !v && m.close()}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {m.form === "new" ? `Tambah ${title}` : `Edit ${title}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={m.handleSubmit(m.submit)} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                Nama <span className="text-destructive">*</span>
              </Label>
              <Input className="h-10" {...m.register("name", { required: true })} />
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={m.close}>
                Batal
              </Button>
              <Button type="submit" disabled={m.formState.isSubmitting}>
                {m.formState.isSubmitting && (
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

export function TaggingRenjaTab() {
  const pkpn = useFlatMaster("/master/pkpn", "PKPN");
  const tematik = useFlatMaster("/master/tematik-renja", "Tematik RENJA");
  const sumberUsulan = useFlatMaster(
    "/master/sumber-usulan-proyek",
    "Sumber Usulan Proyek",
  );
  const taggingDinamis = useFlatMaster(
    "/master/tagging-dinamis",
    "Tagging Dinamis",
  );

  return (
    <div className="space-y-8">
      <FlatMasterTable title="PKPN" m={pkpn} />
      <FlatMasterTable title="Tematik RENJA" m={tematik} />
      <FlatMasterTable title="Sumber Usulan Proyek" m={sumberUsulan} />
      <FlatMasterTable title="Tagging Dinamis" m={taggingDinamis} />
    </div>
  );
}
