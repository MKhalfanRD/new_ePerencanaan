"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ChevronRight } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MasterTable } from "./master-table";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

const subTabs = ["Program", "Kegiatan", "KRO", "RO"];

export function NomenklaturTab() {
  const [activeSubTab, setActiveSubTab] = useState("Program");
  const [programs, setPrograms] = useState<any[]>([]);
  const [kegiatan, setKegiatan] = useState<any[]>([]);
  const [kroList, setKROList] = useState<any[]>([]);
  const [roList, setROList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<any>();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, k, kro, ro] = await Promise.all([
        api.get("/master/programs"),
        api.get("/master/kegiatan"),
        api.get("/master/kro"),
        api.get("/master/ro"),
      ]);
      setPrograms(p.data);
      setKegiatan(k.data);
      setKROList(kro.data);
      setROList(ro.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openAdd = () => {
    setEditData(null);
    reset({});
    setShowForm(true);
  };
  const openEdit = (item: any) => {
    setEditData(item);
    reset({ ...item });
    setShowForm(true);
  };

  const getEndpoint = () => {
    if (activeSubTab === "Program") return "/master/programs";
    if (activeSubTab === "Kegiatan") return "/master/kegiatan";
    if (activeSubTab === "KRO") return "/master/kro";
    return "/master/ro";
  };

  const onSubmit = async (data: any) => {
    try {
      const endpoint = getEndpoint();
      if (editData) {
        await api.patch(`${endpoint}/${editData.id}`, data);
        toast.success(`${activeSubTab} berhasil diperbarui`);
      } else {
        await api.post(endpoint, data);
        toast.success(`${activeSubTab} berhasil ditambahkan`);
      }
      setShowForm(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };

  const onDelete = async (id: string | number) => {
    try {
      await api.delete(`${getEndpoint()}/${id}`);
      toast.success(`${activeSubTab} berhasil dihapus`);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    }
  };

  const onBulkDelete = async (ids: (string | number)[]) => {
    try {
      const res = await api.post(`${getEndpoint()}/bulk-delete`, { ids });
      toast.success(res.data?.message || `${ids.length} data berhasil dihapus`);
      fetchAll();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Gagal menghapus data terpilih",
      );
    }
  };

  const getCurrentData = () => {
    if (activeSubTab === "Program") return programs;
    if (activeSubTab === "Kegiatan") return kegiatan;
    if (activeSubTab === "KRO") return kroList;
    return roList;
  };

  const getColumns = () => {
    if (activeSubTab === "Program")
      return [
        { key: "id", label: "ID" },
        { key: "code", label: "Kode" },
        { key: "name", label: "Nama" },
      ];
    if (activeSubTab === "Kegiatan")
      return [
        { key: "id", label: "ID" },
        { key: "code", label: "Kode" },
        { key: "name", label: "Nama" },
        {
          key: "program",
          label: "Program",
          render: (item: any) => item.program?.name || "—",
        },
      ];
    if (activeSubTab === "KRO")
      return [
        { key: "id", label: "ID" },
        { key: "code", label: "Kode" },
        { key: "name", label: "Nama" },
        {
          key: "kegiatan",
          label: "Kegiatan",
          render: (item: any) => item.kegiatan?.name || "—",
        },
      ];
    return [
      { key: "id", label: "ID" },
      { key: "code", label: "Kode" },
      { key: "name", label: "Nama" },
      {
        key: "kro",
        label: "KRO",
        render: (item: any) => item.kro?.name || "—",
      },
    ];
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb sub tab */}
      <div className="flex items-center gap-1">
        {subTabs.map((tab, i) => (
          <div key={tab} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight size={14} className="text-muted-foreground" />
            )}
            <button
              onClick={() => setActiveSubTab(tab)}
              className={cn(
                "text-sm px-2 py-1 rounded-md font-medium transition-colors",
                activeSubTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {tab}
            </button>
          </div>
        ))}
      </div>

      <MasterTable
        title={activeSubTab}
        data={getCurrentData()}
        loading={loading}
        columns={getColumns()}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={onDelete}
        onBulkDelete={
          activeSubTab === "Kegiatan" ||
          activeSubTab === "KRO" ||
          activeSubTab === "RO"
            ? onBulkDelete
            : undefined
        }
        searchKeys={["name", "code"]}
      />

      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent
          className="!max-w-xl !w-[85vw]"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editData ? `Edit ${activeSubTab}` : `Tambah ${activeSubTab}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  className="h-10"
                  placeholder="Contoh: FC, 7694, CBG"
                  {...register("id")}
                  disabled={!!editData}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Kode <span className="text-destructive">*</span>
                </Label>
                <Input
                  className="h-10"
                  placeholder="Kode"
                  {...register("code")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Nama <span className="text-destructive">*</span>
              </Label>
              <Input
                className="h-10"
                placeholder={`Nama ${activeSubTab}`}
                {...register("name")}
              />
            </div>
            {activeSubTab === "Kegiatan" && (
              <div className="space-y-2">
                <Label>
                  Program <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={watch("programId")}
                  onValueChange={(v) => setValue("programId", v)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Pilih Program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {activeSubTab === "KRO" && (
              <div className="space-y-2">
                <Label>
                  Kegiatan <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={watch("kegiatanId")}
                  onValueChange={(v) => setValue("kegiatanId", v)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Pilih Kegiatan" />
                  </SelectTrigger>
                  <SelectContent>
                    {kegiatan.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.code} — {k.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {activeSubTab === "RO" && (
              <div className="space-y-2">
                <Label>
                  KRO <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={watch("kroId")}
                  onValueChange={(v) => setValue("kroId", v)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Pilih KRO" />
                  </SelectTrigger>
                  <SelectContent>
                    {kroList.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.code} — {k.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
    </div>
  );
}
