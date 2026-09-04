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
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSearchBox,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import { Balai, Periode, RO, Planning } from "@/types";

// Dipakai lewat setValueAs pada input number opsional: input kosong via
// valueAsNumber jadi NaN, bukan undefined — z.number().optional() menolak
// NaN, dan gagalnya senyap (tidak ada FormMessage untuk field ini) sehingga
// tombol submit terkesan "tidak ada respon".
const toOptionalNumber = (v: string) => (v === "" ? undefined : Number(v));

// Sentinel untuk opsi "tidak dipilih" pada Select opsional — Radix Select
// tidak mengizinkan value="".
const NONE = "__NONE__";

const schema = z.object({
  balaiId: z.number({ error: "Balai wajib dipilih" }),
  periodeId: z.number({ error: "Periode wajib dipilih" }),
  projectName: z.string().min(1, "Nama proyek wajib diisi"),
  kewenangan: z.enum(["PUSAT", "DAERAH"]),
  sumberUsulanProyek: z
    .enum([
      "PEMERINTAH_DAERAH",
      "KEMENTERIAN_LEMBAGA",
      "MASYARAKAT",
      "TINDAK_LANJUT_RENAKSI",
      "LAINNYA",
    ])
    .optional(),
  sumberUsulanLainnya: z.string().optional(),
  kebutuhanTanah: z.boolean(),
  sesuaiRTRW: z.string().optional(),
  nomorPerdaRTRW: z.string().optional(),
  sesuaiPolaSDA: z.string().optional(),
  nomorKepmenPUPR: z.string().optional(),
  sesuaiMasterplan: z.string().optional(),
  // StudiLayak/DED/LARAP — angka tahun polos sesuai DB.xlsx, bukan status
  tahunStudiLayak: z.number().optional(),
  tahunDed: z.number().optional(),
  tahunLarap: z.number().optional(),
  // 1 proyek bisa punya banyak Paket — RO/jenis/masa pelaksanaan sekarang
  // menempel di Paket, bukan di Planning (lihat docs-planning/fitur-paket).
  // Form dasar ini: 1 baris = 1 paket dengan 1 alokasi tahun berjalan.
  paket: z.array(
    z.object({
      name: z.string().min(1, "Nama paket wajib diisi"),
      roId: z.string().min(1, "RO wajib dipilih"),
      jenis: z.enum(["FISIK", "NON_FISIK"]),
      masaPelaksanaan: z.enum(["SINGLE_YEAR", "MULTI_YEAR"]),
      tahun: z.number().min(2020),
      status: z.enum(["RENCANA", "REALISASI"]),
      rm: z.number(),
      rmp: z.number(),
      pln: z.number(),
      sbsn: z.number(),
      kpbu: z.number(),
      outputTarget: z.number().optional(),
      outputUnit: z.string().optional(),
      outcomeTarget: z.number().optional(),
      outcomeUnit: z.string().optional(),
      catatan: z.string().optional(),
    }),
  ),
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
  const [balaiSearch, setBalaiSearch] = useState("");
  const [periodeList, setPeriodeList] = useState<Periode[]>([]);
  const [roList, setROList] = useState<RO[]>([]);
  const [roSearch, setRoSearch] = useState("");
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
      kewenangan: "PUSAT",
      kebutuhanTanah: false,
      paket: [],
    },
  });

  const {
    fields: paketFields,
    append: appendPaket,
    remove: removePaket,
  } = useFieldArray({ control, name: "paket" });

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
        kewenangan: editData.kewenangan,
        sumberUsulanProyek: editData.sumberUsulanProyek,
        sumberUsulanLainnya: editData.sumberUsulanLainnya || "",
        kebutuhanTanah: editData.kebutuhanTanah,
        sesuaiRTRW: editData.sesuaiRTRW || "",
        nomorPerdaRTRW: editData.nomorPerdaRTRW || "",
        sesuaiPolaSDA: editData.sesuaiPolaSDA || "",
        nomorKepmenPUPR: editData.nomorKepmenPUPR || "",
        sesuaiMasterplan: editData.sesuaiMasterplan || "",
        tahunStudiLayak: editData.tahunStudiLayak,
        tahunDed: editData.tahunDed,
        tahunLarap: editData.tahunLarap,
        paket: [],
      });
    } else {
      reset({
        kewenangan: "PUSAT",
        kebutuhanTanah: false,
        paket: [],
      });
    }
  }, [editData, open]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit) {
        // Paket dikelola terpisah dari drawer detail, bukan lewat form ini.
        const { paket, ...rest } = data;
        await api.patch(`/plannings/${editData!.id}`, rest);
        toast.success("Proyek berhasil diperbarui");
      } else {
        // 1 baris form = 1 Paket dengan 1 Alokasi tahun berjalan.
        const payload = {
          ...data,
          paket: data.paket.map((p) => ({
            name: p.name,
            roId: p.roId,
            jenis: p.jenis,
            masaPelaksanaan: p.masaPelaksanaan,
            alokasi: [
              {
                tahun: p.tahun,
                status: p.status,
                rm: p.rm,
                rmp: p.rmp,
                pln: p.pln,
                sbsn: p.sbsn,
                kpbu: p.kpbu,
                outputTarget: p.outputTarget,
                outputUnit: p.outputUnit,
                outcomeTarget: p.outcomeTarget,
                outcomeUnit: p.outcomeUnit,
                catatan: p.catatan,
              },
            ],
          })),
        };
        await api.post("/plannings", payload);
        toast.success("Proyek berhasil dibuat");
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
              { label: "Daftar Proyek", onClick: onClose },
              { label: isEdit ? editData!.projectName : "Buat Proyek Baru" },
            ]}
          />
          <SheetTitle className="text-lg leading-snug">
            {isEdit ? "Edit Proyek" : "Buat Proyek Baru"}
          </SheetTitle>
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
                      onOpenChange={(o) => o && setBalaiSearch("")}
                    >
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder="Pilih balai pelaksana" />
                      </SelectTrigger>
                      <SelectContent>
                        {balaiList.length > 20 && (
                          <SelectSearchBox
                            value={balaiSearch}
                            onChange={setBalaiSearch}
                            placeholder="Cari balai..."
                          />
                        )}
                        {balaiList
                          .filter(
                            (b) =>
                              !balaiSearch ||
                              `${b.shortName ?? ""} ${b.name}`
                                .toLowerCase()
                                .includes(balaiSearch.toLowerCase()),
                          )
                          .map((b) => (
                            <SelectItem key={b.id} value={b.id.toString()}>
                              <span className="font-medium">
                                {b.shortName}
                              </span>
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

                  <div className="space-y-2">
                    <Label>Sumber Usulan Proyek</Label>
                    <Select
                      value={watch("sumberUsulanProyek") || NONE}
                      onValueChange={(v) =>
                        setValue(
                          "sumberUsulanProyek",
                          v === NONE ? undefined : (v as any),
                        )
                      }
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Pilih sumber usulan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        <SelectItem value="PEMERINTAH_DAERAH">
                          Pemerintah Daerah
                        </SelectItem>
                        <SelectItem value="KEMENTERIAN_LEMBAGA">
                          Kementerian/Lembaga
                        </SelectItem>
                        <SelectItem value="MASYARAKAT">Masyarakat</SelectItem>
                        <SelectItem value="TINDAK_LANJUT_RENAKSI">
                          Tindak Lanjut Renaksi
                        </SelectItem>
                        <SelectItem value="LAINNYA">Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Pemda & K/L perlu disebutkan yang mana, bukan berhenti
                      di kategori saja — pakai field yang sama dengan
                      "Lainnya", cuma label & placeholder menyesuaikan. */}
                  {(watch("sumberUsulanProyek") === "PEMERINTAH_DAERAH" ||
                    watch("sumberUsulanProyek") === "KEMENTERIAN_LEMBAGA" ||
                    watch("sumberUsulanProyek") === "LAINNYA") && (
                    <div className="col-span-2 space-y-2">
                      <Label>
                        {watch("sumberUsulanProyek") === "PEMERINTAH_DAERAH"
                          ? "Pemerintah Daerah yang Mengusulkan"
                          : watch("sumberUsulanProyek") ===
                              "KEMENTERIAN_LEMBAGA"
                            ? "Kementerian/Lembaga yang Mengusulkan"
                            : "Sumber Usulan Lainnya"}
                      </Label>
                      <Input
                        className="h-10"
                        placeholder={
                          watch("sumberUsulanProyek") === "PEMERINTAH_DAERAH"
                            ? "Contoh: Pemerintah Provinsi Kalimantan Tengah"
                            : watch("sumberUsulanProyek") ===
                                "KEMENTERIAN_LEMBAGA"
                              ? "Contoh: Kementerian Pertanian"
                              : "Sebutkan sumber usulan"
                        }
                        {...register("sumberUsulanLainnya")}
                      />
                    </div>
                  )}
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

              {/* === TAHAPAN DOKUMEN === */}
              <div className="space-y-5">
                <SectionHeader
                  icon={ScrollText}
                  title="Tahapan Dokumen"
                  description="Tahun penyelesaian studi kelayakan, DED, dan LARAP (kosongkan kalau belum ada)"
                />

                <div className="grid grid-cols-3 gap-5 pl-12">
                  <div className="space-y-2">
                    <Label className="text-xs">Studi Kelayakan</Label>
                    <Input
                      type="number"
                      placeholder="Tahun"
                      className="h-9 text-xs"
                      {...register("tahunStudiLayak", {
                        setValueAs: toOptionalNumber,
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">DED</Label>
                    <Input
                      type="number"
                      placeholder="Tahun"
                      className="h-9 text-xs"
                      {...register("tahunDed", {
                        setValueAs: toOptionalNumber,
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">LARAP</Label>
                    <Input
                      type="number"
                      placeholder="Tahun"
                      className="h-9 text-xs"
                      {...register("tahunLarap", {
                        setValueAs: toOptionalNumber,
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* === PAKET & ALOKASI === */}
              {!isEdit && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <SectionHeader
                      icon={Wallet}
                      title="Paket & Alokasi"
                      description="Paket pekerjaan di bawah proyek ini, beserta alokasi anggaran tahun berjalan"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        appendPaket({
                          name: "",
                          roId: "",
                          jenis: "FISIK",
                          masaPelaksanaan: "SINGLE_YEAR",
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
                      <Plus size={15} className="mr-1.5" /> Tambah Paket
                    </Button>
                  </div>

                  <div className="pl-12">
                    {paketFields.length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed p-10 text-center text-muted-foreground text-sm">
                        Belum ada paket ditambahkan.
                        <br />
                        <span className="text-xs">
                          Klik &quot;Tambah Paket&quot; untuk mulai mengisi
                          paket & rincian anggarannya.
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {paketFields.map((field, i) => (
                          <div
                            key={field.id}
                            className="rounded-xl border bg-card p-5 space-y-4"
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Paket #{i + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-muted-foreground hover:text-destructive"
                                onClick={() => removePaket(i)}
                              >
                                <Trash2 size={13} className="mr-1.5" /> Hapus
                              </Button>
                            </div>

                            {/* Nama Paket */}
                            <div className="space-y-2">
                              <Label className="text-xs">
                                Nama Paket{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                className="h-9 text-xs"
                                placeholder="Contoh: Pembangunan Bendungan A Paket I"
                                {...register(`paket.${i}.name`)}
                              />
                            </div>

                            {/* RO */}
                            <div className="space-y-2">
                              <Label className="text-xs">
                                RO (Rincian Output){" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <Select
                                value={watch(`paket.${i}.roId`)}
                                onValueChange={(v) => {
                                  setValue(`paket.${i}.roId`, v);
                                  // Satuan Output ikut RO yang dipilih
                                  // (referensi 1.xlsx), bukan input bebas.
                                  const ro = roList.find((r) => r.id === v);
                                  setValue(
                                    `paket.${i}.outputUnit`,
                                    ro?.satuan || "",
                                  );
                                }}
                                onOpenChange={(o) => o && setRoSearch("")}
                              >
                                <SelectTrigger className="w-full h-9 text-xs">
                                  <SelectValue placeholder="Pilih RO" />
                                </SelectTrigger>
                                <SelectContent>
                                  {roList.length > 20 && (
                                    <SelectSearchBox
                                      value={roSearch}
                                      onChange={setRoSearch}
                                      placeholder="Cari RO..."
                                    />
                                  )}
                                  {roList
                                    .filter(
                                      (r) =>
                                        !roSearch ||
                                        `${r.code} ${r.name}`
                                          .toLowerCase()
                                          .includes(roSearch.toLowerCase()),
                                    )
                                    .map((r) => (
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

                            {/* Jenis Paket + Masa Pelaksanaan */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Jenis Paket</Label>
                                <Select
                                  value={watch(`paket.${i}.jenis`)}
                                  onValueChange={(v) =>
                                    setValue(`paket.${i}.jenis`, v as any)
                                  }
                                >
                                  <SelectTrigger className="h-9 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="FISIK">Fisik</SelectItem>
                                    <SelectItem value="NON_FISIK">
                                      Non-Fisik
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">
                                  Masa Pelaksanaan
                                </Label>
                                <Select
                                  value={watch(`paket.${i}.masaPelaksanaan`)}
                                  onValueChange={(v) =>
                                    setValue(
                                      `paket.${i}.masaPelaksanaan`,
                                      v as any,
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-9 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="SINGLE_YEAR">
                                      Single Year
                                    </SelectItem>
                                    <SelectItem value="MULTI_YEAR">
                                      Multi Year
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Tahun + Status */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Tahun</Label>
                                <Input
                                  type="number"
                                  className="h-9 text-xs"
                                  {...register(`paket.${i}.tahun`, {
                                    valueAsNumber: true,
                                  })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Status</Label>
                                <Select
                                  value={watch(`paket.${i}.status`)}
                                  onValueChange={(v) =>
                                    setValue(`paket.${i}.status`, v as any)
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
                                      {...register(`paket.${i}.${f}`, {
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
                                    {...register(`paket.${i}.outputTarget`, {
                                      setValueAs: toOptionalNumber,
                                    })}
                                  />
                                  <Input
                                    className={`h-9 text-xs w-24 shrink-0 ${
                                      watch(`paket.${i}.outputUnit`)
                                        ? "bg-muted"
                                        : ""
                                    }`}
                                    placeholder="Satuan"
                                    readOnly={!!watch(`paket.${i}.outputUnit`)}
                                    title="Satuan mengikuti RO"
                                    {...register(`paket.${i}.outputUnit`)}
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
                                    {...register(`paket.${i}.outcomeTarget`, {
                                      setValueAs: toOptionalNumber,
                                    })}
                                  />
                                  <Input
                                    className="h-9 text-xs w-24 shrink-0"
                                    placeholder="Satuan"
                                    {...register(`paket.${i}.outcomeUnit`)}
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
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting || loadingMaster}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Simpan Perubahan" : "Buat Proyek"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
