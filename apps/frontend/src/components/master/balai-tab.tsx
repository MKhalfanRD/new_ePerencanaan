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
  latitude?: number;
  longitude?: number;
}

const schema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Nama wajib diisi"),
  shortName: z.string().optional(),
  code: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  const openAdd = () => {
    setEditData(null);
    reset({});
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
            key: "koordinat",
            label: "Koordinat",
            render: (item) =>
              item.latitude ? `${item.latitude}, ${item.longitude}` : "—",
          },
        ]}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={onDelete}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input
                  className="h-10"
                  type="number"
                  step="any"
                  placeholder="-6.123"
                  {...register("latitude", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input
                  className="h-10"
                  type="number"
                  step="any"
                  placeholder="106.123"
                  {...register("longitude", { valueAsNumber: true })}
                />
              </div>
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
