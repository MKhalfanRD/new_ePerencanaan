"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2, ChevronDown } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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

// Section wrapper
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
          {title}
        </p>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </div>
  );
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
        kebutuhanTanah: editData.kebutuhanTanah,
        sesuaiRTRW: editData.sesuaiRTRW || "",
        nomorPerdaRTRW: editData.nomorPerdaRTRW || "",
        sesuaiPolaSDA: editData.sesuaiPolaSDA || "",
        nomorKepmenPUPR: editData.nomorKepmenPUPR || "",
        sesuaiMasterplan: editData.sesuaiMasterplan || "",
        kriteriaDokumen:
          editData.kriteriaDokumen.length > 0
            ? editData.kriteriaDokumen.map((k) => ({
                jenis: k.jenis,
                status: k.status,
                tahun: k.tahun,
              }))
            : KRITERIA_JENIS.map((jenis) => ({
                jenis,
                status: "TIDAK_PERLU" as const,
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

  const dokumenStatusColor = (status: string) => {
    if (status === "SUDAH_ADA") return "default";
    if (status === "BELUM_ADA") return "destructive";
    return "secondary";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      {" "}
      <DialogContent
        className="max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {" "}
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg">
            {isEdit ? "Edit Planning" : "Buat Planning Baru"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lengkapi informasi proyek di bawah ini
          </p>
        </DialogHeader>
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loadingMaster ? (
            <div className="flex items-center justify-center py-16">
              <Loader2
                className="animate-spin text-muted-foreground"
                size={24}
              />
              <span className="ml-3 text-sm text-muted-foreground">
                Memuat data...
              </span>
            </div>
          ) : (
            <>
              {/* === IDENTITAS PROYEK === */}
              <Section title="Identitas Proyek">
                {/* Balai full width */}
                <div className="space-y-1.5">
                  <Label>
                    Balai <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={watch("balaiId")?.toString()}
                    onValueChange={(v) => setValue("balaiId", Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih balai" />
                    </SelectTrigger>
                    <SelectContent>
                      {balaiList.map((b) => (
                        <SelectItem key={b.id} value={b.id.toString()}>
                          <span className="font-medium">{b.shortName}</span>
                          <span className="text-muted-foreground ml-2">
                            — {b.name}
                          </span>
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

                {/* Periode full width */}
                <div className="space-y-1.5">
                  <Label>
                    Periode <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={watch("periodeId")?.toString()}
                    onValueChange={(v) => setValue("periodeId", Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih periode" />
                    </SelectTrigger>
                    <SelectContent>
                      {periodeList.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          <span className="font-medium">{p.label}</span>
                          {p.isActive && (
                            <Badge
                              variant="default"
                              className="ml-2 text-xs py-0"
                            >
                              Aktif
                            </Badge>
                          )}
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

                {/* Nama proyek */}
                <div className="space-y-1.5">
                  <Label>
                    Nama Proyek <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Contoh: Pembangunan Sumur Air Tanah di Kota Palangkaraya"
                    {...register("projectName")}
                  />
                  {errors.projectName && (
                    <p className="text-destructive text-xs">
                      {errors.projectName.message}
                    </p>
                  )}
                </div>

                {/* Masa pelaksanaan + kewenangan */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>
                      Masa Pelaksanaan{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={watch("masaPelaksanaan")}
                      onValueChange={(v) =>
                        setValue("masaPelaksanaan", v as any)
                      }
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
              </Section>

              {/* === KESESUAIAN PROYEK === */}
              <Section title="Kesesuaian Proyek">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Sesuai RTRW/RDTR</Label>
                    <Select
                      value={watch("sesuaiRTRW") || ""}
                      onValueChange={(v) => setValue("sesuaiRTRW", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sesuai">Sesuai</SelectItem>
                        <SelectItem value="Tidak Sesuai">
                          Tidak Sesuai
                        </SelectItem>
                        <SelectItem value="Dalam Proses">
                          Dalam Proses
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>No. Perda RTRW</Label>
                    <Input
                      placeholder="Perda No. ... Tahun ..."
                      {...register("nomorPerdaRTRW")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Sesuai Pola/Rencana SDA</Label>
                    <Select
                      value={watch("sesuaiPolaSDA") || ""}
                      onValueChange={(v) => setValue("sesuaiPolaSDA", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sesuai">Sesuai</SelectItem>
                        <SelectItem value="Tidak Sesuai">
                          Tidak Sesuai
                        </SelectItem>
                        <SelectItem value="Dalam Proses">
                          Dalam Proses
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>No. Kepmen PUPR</Label>
                    <Input
                      placeholder="Kepmen PUPR no. ..."
                      {...register("nomorKepmenPUPR")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Sesuai Masterplan</Label>
                    <Input
                      placeholder="Masterplan ..."
                      {...register("sesuaiMasterplan")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kebutuhan Tanah</Label>
                    <Select
                      value={watch("kebutuhanTanah") ? "ya" : "tidak"}
                      onValueChange={(v) =>
                        setValue("kebutuhanTanah", v === "ya")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tidak">Tidak Ada</SelectItem>
                        <SelectItem value="ya">Ada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Section>

              {/* === KRITERIA DOKUMEN === */}
              <Section title="Kriteria Dokumen">
                <div className="rounded-lg border overflow-hidden">
                  {KRITERIA_JENIS.map((jenis, i) => {
                    const status = watch(`kriteriaDokumen.${i}.status`);
                    return (
                      <div
                        key={jenis}
                        className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <span className="text-sm flex-1 min-w-0">{jenis}</span>
                        <Select
                          value={status}
                          onValueChange={(v) =>
                            setValue(`kriteriaDokumen.${i}.status`, v as any)
                          }
                        >
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TIDAK_PERLU">
                              Tidak Perlu
                            </SelectItem>
                            <SelectItem value="BELUM_ADA">Belum Ada</SelectItem>
                            <SelectItem value="SUDAH_ADA">Sudah Ada</SelectItem>
                          </SelectContent>
                        </Select>
                        {status !== "TIDAK_PERLU" && (
                          <Input
                            type="number"
                            placeholder="Tahun"
                            className="w-24 h-8 text-xs"
                            {...register(`kriteriaDokumen.${i}.tahun`, {
                              valueAsNumber: true,
                            })}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* === ALOKASI === */}
              {!isEdit && (
                <Section title="Alokasi Anggaran">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {alokasiFields.length} alokasi ditambahkan
                    </p>
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
                      <Plus size={14} className="mr-1.5" /> Tambah Alokasi
                    </Button>
                  </div>

                  {alokasiFields.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
                      Belum ada alokasi. Klik tombol di atas untuk menambahkan.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {alokasiFields.map((field, i) => (
                        <div
                          key={field.id}
                          className="rounded-lg border p-4 space-y-3 bg-muted/20"
                        >
                          {/* Header alokasi */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              Alokasi {i + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => removeAlokasi(i)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>

                          {/* RO full width */}
                          <div className="space-y-1.5">
                            <Label className="text-xs">
                              RO (Rincian Output){" "}
                              <span className="text-destructive">*</span>
                            </Label>
                            <Select
                              value={watch(`alokasi.${i}.roId`)}
                              onValueChange={(v) =>
                                setValue(`alokasi.${i}.roId`, v)
                              }
                            >
                              <SelectTrigger className="w-full text-xs">
                                <SelectValue placeholder="Pilih RO" />
                              </SelectTrigger>
                              <SelectContent className="max-w-lg">
                                {roList.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    <span className="font-medium">
                                      {r.kro.kegiatan.program.code} ·{" "}
                                      {r.kro.code} · {r.code}
                                    </span>
                                    <span className="text-muted-foreground ml-2 text-xs">
                                      — {r.name}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Tahun + Status */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Tahun</Label>
                              <Input
                                type="number"
                                className="text-xs"
                                {...register(`alokasi.${i}.tahun`, {
                                  valueAsNumber: true,
                                })}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Status</Label>
                              <Select
                                value={watch(`alokasi.${i}.status`)}
                                onValueChange={(v) =>
                                  setValue(`alokasi.${i}.status`, v as any)
                                }
                              >
                                <SelectTrigger className="text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="RENCANA">
                                    Rencana
                                  </SelectItem>
                                  <SelectItem value="REALISASI">
                                    Realisasi
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Sumber dana */}
                          <div>
                            <Label className="text-xs mb-2 block">
                              Sumber Dana (Rp)
                            </Label>
                            <div className="grid grid-cols-5 gap-2">
                              {(
                                ["rm", "rmp", "pln", "sbsn", "kpbu"] as const
                              ).map((f) => (
                                <div key={f} className="space-y-1">
                                  <p className="text-xs text-center text-muted-foreground uppercase font-medium">
                                    {f}
                                  </p>
                                  <Input
                                    type="number"
                                    className="text-xs text-center px-2"
                                    placeholder="0"
                                    {...register(`alokasi.${i}.${f}`, {
                                      valueAsNumber: true,
                                    })}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Output & Outcome */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Output Target</Label>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number"
                                  className="text-xs"
                                  placeholder="0"
                                  {...register(`alokasi.${i}.outputTarget`, {
                                    valueAsNumber: true,
                                  })}
                                />
                                <Input
                                  className="text-xs w-20 shrink-0"
                                  placeholder="Satuan"
                                  {...register(`alokasi.${i}.outputUnit`)}
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Outcome Target</Label>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number"
                                  className="text-xs"
                                  placeholder="0"
                                  {...register(`alokasi.${i}.outcomeTarget`, {
                                    valueAsNumber: true,
                                  })}
                                />
                                <Input
                                  className="text-xs w-20 shrink-0"
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
                </Section>
              )}
            </>
          )}
        </div>
        {/* Footer sticky */}
        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background rounded-b-lg">
          {" "}
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting || loadingMaster}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Simpan Perubahan" : "Buat Planning"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
