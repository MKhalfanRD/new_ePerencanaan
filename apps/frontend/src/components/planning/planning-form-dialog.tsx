"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  Plus,
  Trash2,
  MapPin,
  FileCheck,
  Wallet,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetBreadcrumb,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// === Section header dengan icon, lebih lega ===
function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-3 pb-1">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
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

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <SheetContent
        layer="1"
        className="!p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header — pola sama dengan planning-detail-sheet.tsx (breadcrumb
            + judul), supaya alur lihat→edit terasa satu drawer yang
            konsisten, bukan berpindah ke gaya modal yang berbeda. */}
        <SheetHeader className="gap-2 pb-4">
          <SheetBreadcrumb
            items={[
              { label: "Daftar Planning", onClick: onClose },
              { label: isEdit ? editData!.projectName : "Buat Planning Baru" },
            ]}
          />
          <h2 className="text-lg font-semibold leading-snug">
            {isEdit ? "Edit Planning" : "Buat Planning Baru"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Lengkapi informasi proyek perencanaan anggaran di bawah ini
          </p>
        </SheetHeader>

        {/* Scrollable content */}
        <SheetBody className="px-6 py-6 space-y-9">
          {loadingMaster ? (
            <div className="flex items-center justify-center py-20">
              <Loader2
                className="animate-spin text-muted-foreground"
                size={28}
              />
              <span className="ml-3 text-sm text-muted-foreground">
                Memuat data referensi...
              </span>
            </div>
          ) : (
            <>
              {/* === IDENTITAS PROYEK === */}
              <div className="space-y-5">
                <SectionHeader
                  icon={MapPin}
                  title="Identitas Proyek"
                  description="Informasi dasar mengenai proyek dan unit pelaksana"
                />

                <div className="grid grid-cols-2 gap-5 pl-12">
                  <div className="space-y-2">
                    <Label>
                      Balai <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={watch("balaiId")?.toString()}
                      onValueChange={(v) => setValue("balaiId", Number(v))}
                    >
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder="Pilih balai pelaksana" />
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

                  <div className="space-y-2">
                    <Label>
                      Periode <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={watch("periodeId")?.toString()}
                      onValueChange={(v) => setValue("periodeId", Number(v))}
                    >
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder="Pilih periode anggaran" />
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

                  <div className="col-span-2 space-y-2">
                    <Label>
                      Nama Proyek <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      className="h-10"
                      placeholder="Contoh: Pembangunan Sumur Air Tanah di Kota Palangkaraya"
                      {...register("projectName")}
                    />
                    {errors.projectName && (
                      <p className="text-destructive text-xs">
                        {errors.projectName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
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
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SINGLE_YEAR">Single Year</SelectItem>
                        <SelectItem value="MULTI_YEAR">Multi Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Kewenangan</Label>
                    <Select
                      value={watch("kewenangan")}
                      onValueChange={(v) => setValue("kewenangan", v as any)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PUSAT">Pusat</SelectItem>
                        <SelectItem value="DAERAH">Daerah</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* === KESESUAIAN PROYEK === */}
              <div className="space-y-5">
                <SectionHeader
                  icon={FileCheck}
                  title="Kesesuaian Proyek"
                  description="Keterkaitan proyek dengan rencana tata ruang dan pengelolaan SDA"
                />

                <div className="grid grid-cols-2 gap-5 pl-12">
                  <div className="space-y-2">
                    <Label>Sesuai RTRW/RDTR</Label>
                    <Select
                      value={watch("sesuaiRTRW") || ""}
                      onValueChange={(v) => setValue("sesuaiRTRW", v)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Pilih status" />
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
                  <div className="space-y-2">
                    <Label>No. Perda RTRW</Label>
                    <Input
                      className="h-10"
                      placeholder="Perda No. ... Tahun ..."
                      {...register("nomorPerdaRTRW")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Sesuai Pola/Rencana SDA</Label>
                    <Select
                      value={watch("sesuaiPolaSDA") || ""}
                      onValueChange={(v) => setValue("sesuaiPolaSDA", v)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Pilih status" />
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
                  <div className="space-y-2">
                    <Label>No. Kepmen PUPR</Label>
                    <Input
                      className="h-10"
                      placeholder="Kepmen PUPR no. ..."
                      {...register("nomorKepmenPUPR")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Sesuai Masterplan</Label>
                    <Input
                      className="h-10"
                      placeholder="Masterplan ..."
                      {...register("sesuaiMasterplan")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kebutuhan Tanah</Label>
                    <Select
                      value={watch("kebutuhanTanah") ? "ya" : "tidak"}
                      onValueChange={(v) =>
                        setValue("kebutuhanTanah", v === "ya")
                      }
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tidak">Tidak Ada</SelectItem>
                        <SelectItem value="ya">Ada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* === KRITERIA DOKUMEN === */}
              <div className="space-y-5">
                <SectionHeader
                  icon={ScrollText}
                  title="Kriteria Dokumen"
                  description="Status kelengkapan dokumen pendukung proyek"
                />

                <div className="pl-12 space-y-2.5">
                  {KRITERIA_JENIS.map((jenis, i) => {
                    const status = watch(`kriteriaDokumen.${i}.status`);
                    return (
                      <div
                        key={jenis}
                        className="flex items-center gap-4 px-4 py-3 rounded-xl border bg-card hover:bg-accent/30 transition-colors"
                      >
                        <span className="text-sm flex-1 min-w-0">{jenis}</span>
                        <Select
                          value={status}
                          onValueChange={(v) =>
                            setValue(`kriteriaDokumen.${i}.status`, v as any)
                          }
                        >
                          <SelectTrigger className="w-36 h-9 text-xs shrink-0">
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
                            className="w-24 h-9 text-xs shrink-0"
                            {...register(`kriteriaDokumen.${i}.tahun`, {
                              valueAsNumber: true,
                            })}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* === ALOKASI === */}
              {!isEdit && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <SectionHeader
                      icon={Wallet}
                      title="Alokasi Anggaran"
                      description="Rincian anggaran per tahun dan sumber dana"
                    />
                    <Button
                      type="button"
                      variant="outline"
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
                      <Plus size={15} className="mr-1.5" /> Tambah Alokasi
                    </Button>
                  </div>

                  <div className="pl-12">
                    {alokasiFields.length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed p-10 text-center text-muted-foreground text-sm">
                        Belum ada alokasi anggaran ditambahkan.
                        <br />
                        <span className="text-xs">
                          Klik &quot;Tambah Alokasi&quot; untuk mulai mengisi
                          rincian anggaran.
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {alokasiFields.map((field, i) => (
                          <div
                            key={field.id}
                            className="rounded-xl border bg-card p-5 space-y-4"
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Alokasi #{i + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-muted-foreground hover:text-destructive"
                                onClick={() => removeAlokasi(i)}
                              >
                                <Trash2 size={13} className="mr-1.5" /> Hapus
                              </Button>
                            </div>

                            {/* RO */}
                            <div className="space-y-2">
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
                                <SelectTrigger className="w-full h-9 text-xs">
                                  <SelectValue placeholder="Pilih RO" />
                                </SelectTrigger>
                                <SelectContent>
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
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Tahun</Label>
                                <Input
                                  type="number"
                                  className="h-9 text-xs"
                                  {...register(`alokasi.${i}.tahun`, {
                                    valueAsNumber: true,
                                  })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Status</Label>
                                <Select
                                  value={watch(`alokasi.${i}.status`)}
                                  onValueChange={(v) =>
                                    setValue(`alokasi.${i}.status`, v as any)
                                  }
                                >
                                  <SelectTrigger className="h-9 text-xs">
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
                            <div className="space-y-2">
                              <Label className="text-xs">
                                Sumber Dana (Rp)
                              </Label>
                              <div className="grid grid-cols-5 gap-3">
                                {(
                                  ["rm", "rmp", "pln", "sbsn", "kpbu"] as const
                                ).map((f) => (
                                  <div key={f} className="space-y-1.5">
                                    <p className="text-xs text-center text-muted-foreground uppercase font-medium">
                                      {f}
                                    </p>
                                    <Input
                                      type="number"
                                      className="text-xs text-center h-9 px-2"
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
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Output Target</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    className="h-9 text-xs"
                                    placeholder="0"
                                    {...register(`alokasi.${i}.outputTarget`, {
                                      valueAsNumber: true,
                                    })}
                                  />
                                  <Input
                                    className="h-9 text-xs w-24 shrink-0"
                                    placeholder="Satuan"
                                    {...register(`alokasi.${i}.outputUnit`)}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">
                                  Outcome Target
                                </Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    className="h-9 text-xs"
                                    placeholder="0"
                                    {...register(`alokasi.${i}.outcomeTarget`, {
                                      valueAsNumber: true,
                                    })}
                                  />
                                  <Input
                                    className="h-9 text-xs w-24 shrink-0"
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
                </div>
              )}
            </>
          )}
        </SheetBody>

        {/* Footer */}
        <SheetFooter>
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
