"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import api from "@/lib/api";
import { Balai, Periode, RO, Planning } from "@/types";

const KRITERIA_JENIS = [
  "Dokumen Lingkungan",
  "Studi Kelayakan",
  "Detail Enginering Design (DED)",
  "Kesiapan Lahan (LARAP)",
  "Persetujuan Multi Year Contract",
];

const schema = z.object({
  balaiId: z.number({ required_error: "Balai wajib dipilih" }),
  periodeId: z.number({ required_error: "Periode wajib dipilih" }),
  projectName: z.string().min(1, "Nama proyek wajib diisi"),
  masaPelaksanaan: z.enum(["SINGLE_YEAR", "MULTI_YEAR"]),
  kewenangan: z.enum(["PUSAT", "DAERAH"]).default("PUSAT"),
  wilayahSungaiId: z.string().optional(),
  kebutuhanTanah: z.boolean().default(false),
  sesuaiRTRW: z.string().optional(),
  nomorPerdaRTRW: z.string().optional(),
  sesuaiPolaSDA: z.string().optional(),
  nomorKepmenPUPR: z.string().optional(),
  sesuaiMasterplan: z.string().optional(),
  kriteriaDokumen: z
    .array(
      z.object({
        jenis: z.string(),
        status: z.enum(["TIDAK_PERLU", "BELUM_ADA", "SUDAH_ADA"]),
        tahun: z.number().optional(),
      }),
    )
    .default([]),
  alokasi: z
    .array(
      z.object({
        roId: z.string().min(1, "RO wajib dipilih"),
        tahun: z.number().min(2020),
        status: z.enum(["RENCANA", "REALISASI"]),
        rm: z.number().default(0),
        rmp: z.number().default(0),
        pln: z.number().default(0),
        sbsn: z.number().default(0),
        kpbu: z.number().default(0),
        outputTarget: z.number().optional(),
        outputUnit: z.string().optional(),
        outcomeTarget: z.number().optional(),
        outcomeUnit: z.string().optional(),
        catatan: z.string().optional(),
      }),
    )
    .default([]),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: Planning | null;
}

export function PlanningFormDialog({
  open,
  onClose,
  onSuccess,
  editData,
}: Props) {
  const [balaiList, setBalaiList] = useState<Balai[]>([]);
  const [periodeList, setPeriodeList] = useState<Periode[]>([]);
  const [roList, setROList] = useState<RO[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);

  const isEdit = !!editData;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      masaPelaksanaan: "SINGLE_YEAR",
      kewenangan: "PUSAT",
      kebutuhanTanah: false,
      kriteriaDokumen: KRITERIA_JENIS.map((jenis) => ({
        jenis,
        status: "TIDAK_PERLU",
      })),
      alokasi: [],
    },
  });

  const {
    fields: alokasiFields,
    append: appendAlokasi,
    remove: removeAlokasi,
  } = useFieldArray({ control, name: "alokasi" });

  useEffect(() => {
    if (!open) return;
    setLoadingMaster(true);
    Promise.all([
      api.get("/master/balai"),
      api.get("/master/periodes"),
      api.get("/master/ro"),
    ])
      .then(([b, p, r]) => {
        setBalaiList(b.data);
        setPeriodeList(p.data);
        setROList(r.data);
      })
      .finally(() => setLoadingMaster(false));
  }, [open]);

  useEffect(() => {
    if (editData) {
      reset({
        balaiId: editData.balai.id,
        periodeId: editData.periode.id,
        projectName: editData.projectName,
        masaPelaksanaan: editData.masaPelaksanaan,
        kewenangan: editData.kewenangan,
        wilayahSungaiId: editData.wilayahSungai?.id,
        kebutuhanTanah: editData.kebutuhanTanah,
        sesuaiRTRW: editData.sesuaiRTRW || "",
        nomorPerdaRTRW: editData.nomorPerdaRTRW || "",
        sesuaiPolaSDA: editData.sesuaiPolaSDA || "",
        nomorKepmenPUPR: editData.nomorKepmenPUPR || "",
        sesuaiMasterplan: editData.sesuaiMasterplan || "",
        kriteriaDokumen: editData.kriteriaDokumen.map((k) => ({
          jenis: k.jenis,
          status: k.status,
          tahun: k.tahun,
        })),
        alokasi: [],
      });
    } else {
      reset({
        masaPelaksanaan: "SINGLE_YEAR",
        kewenangan: "PUSAT",
        kebutuhanTanah: false,
        kriteriaDokumen: KRITERIA_JENIS.map((jenis) => ({
          jenis,
          status: "TIDAK_PERLU",
        })),
        alokasi: [],
      });
    }
  }, [editData, open]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit) {
        await api.patch(`/plannings/${editData!.id}`, data);
        toast.success("Planning berhasil diperbarui");
      } else {
        await api.post("/plannings", data);
        toast.success("Planning berhasil dibuat");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Planning" : "Buat Planning Baru"}
          </DialogTitle>
        </DialogHeader>

        {loadingMaster ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Identitas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Balai *</Label>
                <Select
                  value={watch("balaiId")?.toString()}
                  onValueChange={(v) => setValue("balaiId", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih balai" />
                  </SelectTrigger>
                  <SelectContent>
                    {balaiList.map((b) => (
                      <SelectItem key={b.id} value={b.id.toString()}>
                        {b.shortName} — {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.balaiId && (
                  <p className="text-destructive text-xs">
                    {errors.balaiId.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Periode *</Label>
                <Select
                  value={watch("periodeId")?.toString()}
                  onValueChange={(v) => setValue("periodeId", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih periode" />
                  </SelectTrigger>
                  <SelectContent>
                    {periodeList.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.label} {p.isActive && "(Aktif)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.periodeId && (
                  <p className="text-destructive text-xs">
                    {errors.periodeId.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nama Proyek *</Label>
              <Input placeholder="Nama proyek" {...register("projectName")} />
              {errors.projectName && (
                <p className="text-destructive text-xs">
                  {errors.projectName.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Masa Pelaksanaan *</Label>
                <Select
                  value={watch("masaPelaksanaan")}
                  onValueChange={(v) => setValue("masaPelaksanaan", v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE_YEAR">Single Year</SelectItem>
                    <SelectItem value="MULTI_YEAR">Multi Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Kewenangan</Label>
                <Select
                  value={watch("kewenangan")}
                  onValueChange={(v) => setValue("kewenangan", v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUSAT">Pusat</SelectItem>
                    <SelectItem value="DAERAH">Daerah</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Kriteria Dokumen */}
            <div>
              <p className="text-sm font-medium mb-3">Kriteria Dokumen</p>
              <div className="space-y-2">
                {KRITERIA_JENIS.map((jenis, i) => (
                  <div
                    key={jenis}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/40"
                  >
                    <span className="text-sm flex-1">{jenis}</span>
                    <Select
                      value={watch(`kriteriaDokumen.${i}.status`)}
                      onValueChange={(v) =>
                        setValue(`kriteriaDokumen.${i}.status`, v as any)
                      }
                    >
                      <SelectTrigger className="w-36 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TIDAK_PERLU">Tidak Perlu</SelectItem>
                        <SelectItem value="BELUM_ADA">Belum Ada</SelectItem>
                        <SelectItem value="SUDAH_ADA">Sudah Ada</SelectItem>
                      </SelectContent>
                    </Select>
                    {watch(`kriteriaDokumen.${i}.status`) !== "TIDAK_PERLU" && (
                      <Input
                        type="number"
                        placeholder="Tahun"
                        className="w-24 h-8"
                        {...register(`kriteriaDokumen.${i}.tahun`, {
                          valueAsNumber: true,
                        })}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Alokasi */}
            {!isEdit && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">Alokasi Anggaran</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendAlokasi({
                        roId: "",
                        tahun: new Date().getFullYear(),
                        status: "RENCANA",
                        rm: 0,
                        rmp: 0,
                        pln: 0,
                        sbsn: 0,
                        kpbu: 0,
                      })
                    }
                  >
                    <Plus size={14} className="mr-1" /> Tambah Alokasi
                  </Button>
                </div>

                {alokasiFields.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Belum ada alokasi. Klik "Tambah Alokasi" untuk menambahkan.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {alokasiFields.map((field, i) => (
                      <div
                        key={field.id}
                        className="p-3 border rounded-lg space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            Alokasi {i + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeAlokasi(i)}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">RO *</Label>
                            <Select
                              value={watch(`alokasi.${i}.roId`)}
                              onValueChange={(v) =>
                                setValue(`alokasi.${i}.roId`, v)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Pilih RO" />
                              </SelectTrigger>
                              <SelectContent>
                                {roList.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    {r.code} — {r.name.substring(0, 40)}...
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Tahun</Label>
                            <Input
                              type="number"
                              className="h-8 text-xs"
                              {...register(`alokasi.${i}.tahun`, {
                                valueAsNumber: true,
                              })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Status</Label>
                            <Select
                              value={watch(`alokasi.${i}.status`)}
                              onValueChange={(v) =>
                                setValue(`alokasi.${i}.status`, v as any)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="RENCANA">Rencana</SelectItem>
                                <SelectItem value="REALISASI">
                                  Realisasi
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {(["rm", "rmp", "pln", "sbsn", "kpbu"] as const).map(
                            (field) => (
                              <div key={field} className="space-y-1">
                                <Label className="text-xs uppercase">
                                  {field}
                                </Label>
                                <Input
                                  type="number"
                                  className="h-8 text-xs"
                                  placeholder="0"
                                  {...register(`alokasi.${i}.${field}`, {
                                    valueAsNumber: true,
                                  })}
                                />
                              </div>
                            ),
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Output Target</Label>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                className="h-8 text-xs"
                                placeholder="0"
                                {...register(`alokasi.${i}.outputTarget`, {
                                  valueAsNumber: true,
                                })}
                              />
                              <Input
                                className="h-8 text-xs w-20"
                                placeholder="Satuan"
                                {...register(`alokasi.${i}.outputUnit`)}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Outcome Target</Label>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                className="h-8 text-xs"
                                placeholder="0"
                                {...register(`alokasi.${i}.outcomeTarget`, {
                                  valueAsNumber: true,
                                })}
                              />
                              <Input
                                className="h-8 text-xs w-20"
                                placeholder="Satuan"
                                {...register(`alokasi.${i}.outcomeUnit`)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEdit ? "Simpan Perubahan" : "Buat Planning"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
