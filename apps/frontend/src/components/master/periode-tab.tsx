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

interface Periode {
  id: number;
  startYear: number;
  endYear: number;
  label: string;
  isActive: boolean;
}

const schema = z.object({
  startYear: z.number().min(2000),
  endYear: z.number().min(2000),
  label: z.string().min(1),
  isActive: z.boolean().default(false),
});

type FormData = z.infer<typeof schema>;

export function PeriodeTab() {
  const [data, setData] = useState<Periode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Periode | null>(null);

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
      const res = await api.get("/master/periodes");
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  // Auto generate label dari startYear & endYear
  const startYear = watch("startYear");
  const endYear = watch("endYear");
  useEffect(() => {
    if (startYear && endYear) setValue("label", `${startYear}-${endYear}`);
  }, [startYear, endYear]);

  const openAdd = () => {
    setEditData(null);
    reset({ isActive: false });
    setShowForm(true);
  };
  const openEdit = (item: Periode) => {
    setEditData(item);
    reset({ ...item });
    setShowForm(true);
  };

  const onSubmit = async (data: FormData) => {
    try {
      if (editData) {
        await api.patch(`/master/periodes/${editData.id}`, data);
        toast.success("Periode berhasil diperbarui");
      } else {
        await api.post("/master/periodes", data);
        toast.success("Periode berhasil ditambahkan");
      }
      setShowForm(false);
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };

  const onDelete = async (id: string | number) => {
    try {
      await api.delete(`/master/periodes/${id}`);
      toast.success("Periode berhasil dihapus");
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  return (
    <>
      <MasterTable
        title="Periode"
        data={data}
        loading={loading}
        columns={[
          { key: "label", label: "Periode" },
          { key: "startYear", label: "Tahun Mulai" },
          { key: "endYear", label: "Tahun Selesai" },
          {
            key: "isActive",
            label: "Status",
            render: (item) =>
              item.isActive ? (
                <Badge variant="default" className="text-xs">
                  Aktif
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Tidak Aktif
                </Badge>
              ),
          },
        ]}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={onDelete}
        searchKeys={["label"]}
      />

      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent
          className="max-w-sm"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editData ? "Edit Periode" : "Tambah Periode"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Tahun Mulai <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder="2025"
                  {...register("startYear", { valueAsNumber: true })}
                />
                {errors.startYear && (
                  <p className="text-destructive text-xs">Wajib diisi</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>
                  Tahun Selesai <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder="2029"
                  {...register("endYear", { valueAsNumber: true })}
                />
                {errors.endYear && (
                  <p className="text-destructive text-xs">Wajib diisi</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input placeholder="2025-2029" {...register("label")} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                {...register("isActive")}
                className="rounded"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Jadikan periode aktif
              </Label>
            </div>
            <DialogFooter className="pt-2">
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
