"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";

interface AlokasiLike {
  id: string;
  tahun: number;
  status: "RENCANA" | "REALISASI";
  rm: string | number;
  rmp: string | number;
  pln: string | number;
  sbsn: string | number;
  kpbu: string | number;
  outputTarget?: string | number;
  outputUnit?: string;
  outcomeTarget?: string | number;
  outcomeUnit?: string;
  catatan?: string;
}

// Input number kosong via valueAsNumber jadi NaN, bukan undefined —
// z.number().optional() menolak NaN, gagalnya senyap (lihat bug submit
// planning-form-dialog.tsx yang sama).
const toOptionalNumber = (v: string) => (v === "" ? undefined : Number(v));

const schema = z.object({
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
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  paketId: string;
  /** Satuan resmi RO paket ini (dari referensi 1.xlsx) — mengunci field
   * Satuan Output Target, bukan input teks bebas. */
  roSatuan?: string | null;
  editData?: AlokasiLike | null;
  /** Nama proyek — dipakai di breadcrumb header. */
  projectName?: string;
  /**
   * Klik segmen "Daftar Proyek" di breadcrumb — menutup Sheet lapis-2 ini
   * SEKALIGUS Sheet lapis-1 di baliknya (kembali ke daftar). Opsional: kalau
   * tidak disediakan, segmen tersebut tidak clickable.
   */
  onNavigateToList?: () => void;
}

export function AlokasiFormDialog({
  open,
  onClose,
  onSuccess,
  paketId,
  roSatuan,
  editData,
  projectName,
  onNavigateToList,
}: Props) {
  const isEdit = !!editData;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tahun: new Date().getFullYear(),
      status: "RENCANA",
      rm: 0,
      rmp: 0,
      pln: 0,
      sbsn: 0,
      kpbu: 0,
    },
  });

  useEffect(() => {
    if (editData) {
      reset({
        tahun: editData.tahun,
        status: editData.status,
        rm: Number(editData.rm),
        rmp: Number(editData.rmp),
        pln: Number(editData.pln),
        sbsn: Number(editData.sbsn),
        kpbu: Number(editData.kpbu),
        outputTarget: editData.outputTarget
          ? Number(editData.outputTarget)
          : undefined,
        // Satuan ikut RO paket (sumber kebenaran) — fallback ke nilai lama
        // kalau RO belum punya satuan resmi di master data.
        outputUnit: roSatuan || editData.outputUnit || "",
        outcomeTarget: editData.outcomeTarget
          ? Number(editData.outcomeTarget)
          : undefined,
        outcomeUnit: editData.outcomeUnit || "",
        catatan: editData.catatan || "",
      });
    } else {
      reset({
        tahun: new Date().getFullYear(),
        status: "RENCANA",
        rm: 0,
        rmp: 0,
        pln: 0,
        sbsn: 0,
        kpbu: 0,
        outputUnit: roSatuan || "",
      });
    }
  }, [editData, open, roSatuan]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit) {
        // tahun & status sengaja tidak ada di UpdateAlokasiDto (immutable
        // setelah dibuat) — backend forbidNonWhitelisted, jadi harus dibuang
        // dari payload di sini, bukan cuma disable di UI.
        const { tahun, status, ...editable } = data;
        await api.patch(`/alokasi/${editData!.id}`, editable);
        toast.success("Alokasi berhasil diperbarui");
      } else {
        await api.post("/alokasi", { ...data, paketId });
        toast.success("Alokasi berhasil ditambahkan");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };

  const tahunWatch = watch("tahun");
  const currentPageLabel = isEdit
    ? `Edit Alokasi ${tahunWatch || editData?.tahun || ""}`
    : "Tambah Alokasi";

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent
        layer="2"
        className="!p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="gap-1.5">
          <SheetBreadcrumb
            items={[
              { label: "Daftar Proyek", onClick: onNavigateToList },
              { label: projectName || "Proyek", onClick: onClose },
              { label: currentPageLabel },
            ]}
          />
          <SheetTitle className="text-base leading-snug">
            {isEdit ? "Edit Alokasi" : "Tambah Alokasi Baru"}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            {isEdit
              ? "Perubahan akan tercatat di histori alokasi"
              : "Tambahkan alokasi anggaran untuk tahun tertentu"}
          </p>
        </SheetHeader>

        <SheetBody className="px-5 py-5 space-y-5">
          <>
              {/* Tahun + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tahun</Label>
                  <Input
                    className="h-10"
                    type="number"
                    disabled={isEdit}
                    {...register("tahun", { valueAsNumber: true })}
                  />
                  {isEdit && (
                    <p className="text-xs text-muted-foreground">
                      Tidak dapat diubah
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={watch("status")}
                    onValueChange={(v) => setValue("status", v as any)}
                    disabled={isEdit}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RENCANA">Rencana</SelectItem>
                      <SelectItem value="REALISASI">Realisasi</SelectItem>
                    </SelectContent>
                  </Select>
                  {isEdit && (
                    <p className="text-xs text-muted-foreground">
                      Tidak dapat diubah
                    </p>
                  )}
                </div>
              </div>

              {/* Sumber dana — grid 5 kolom (RM/RMP/PLN/SBSN/KPBU sejajar),
                  sesuai `.grid5` di mockup, bukan 2 kolom. */}
              <div className="space-y-2">
                <Label>Sumber Dana (Rp)</Label>
                <div className="grid grid-cols-5 gap-2">
                  {(["rm", "rmp", "pln", "sbsn", "kpbu"] as const).map((f) => (
                    <div key={f} className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                        {f}
                      </p>
                      <Input
                        type="number"
                        className="text-xs h-9 px-1.5"
                        placeholder="0"
                        {...register(f, { valueAsNumber: true })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Output & Outcome — stacked karena panel sempit */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Output Target</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      className="h-10"
                      placeholder="0"
                      {...register("outputTarget", {
                        setValueAs: toOptionalNumber,
                      })}
                    />
                    {/* Satuan ikut RO paket (referensi 1.xlsx) — dikunci,
                        bukan input bebas, supaya tidak salah ketik/beda
                        istilah dari satuan resmi. */}
                    <Input
                      className={`h-10 w-24 shrink-0 ${roSatuan ? "bg-muted" : ""}`}
                      placeholder="Satuan"
                      readOnly={!!roSatuan}
                      title={roSatuan ? "Satuan mengikuti RO" : undefined}
                      {...register("outputUnit")}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Outcome Target</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      className="h-10"
                      placeholder="0"
                      {...register("outcomeTarget", {
                        setValueAs: toOptionalNumber,
                      })}
                    />
                    <Input
                      className="h-10 w-24 shrink-0"
                      placeholder="Satuan"
                      {...register("outcomeUnit")}
                    />
                  </div>
                </div>
              </div>

              {/* Catatan */}
              <div className="space-y-2">
                <Label>Catatan</Label>
                <Input
                  className="h-10"
                  placeholder="Catatan tambahan (opsional)"
                  {...register("catatan")}
                />
              </div>
          </>
        </SheetBody>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Simpan Perubahan" : "Tambah Alokasi"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
