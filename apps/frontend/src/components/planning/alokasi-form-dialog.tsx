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
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { RO } from "@/types";

interface AlokasiLike {
  id: string;
  roId?: string;
  ro?: { id: string };
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

const schema = z.object({
  roId: z.string().min(1, "RO wajib dipilih"),
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
  planningId: string;
  editData?: AlokasiLike | null;
  /** Nama proyek — dipakai di breadcrumb header. */
  projectName?: string;
  /**
   * Klik segmen "Daftar Planning" di breadcrumb — menutup Sheet lapis-2 ini
   * SEKALIGUS Sheet lapis-1 di baliknya (kembali ke daftar). Opsional: kalau
   * tidak disediakan, segmen tersebut tidak clickable.
   */
  onNavigateToList?: () => void;
}

export function AlokasiFormDialog({
  open,
  onClose,
  onSuccess,
  planningId,
  editData,
  projectName,
  onNavigateToList,
}: Props) {
  const [roList, setROList] = useState<RO[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);
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
    if (!open) return;
    setLoadingMaster(true);
    api
      .get("/master/ro")
      .then((res) => setROList(res.data))
      .finally(() => setLoadingMaster(false));
  }, [open]);

  useEffect(() => {
    if (editData) {
      reset({
        roId: editData.roId || editData.ro?.id || "",
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
        outputUnit: editData.outputUnit || "",
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
      });
    }
  }, [editData, open]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit) {
        await api.patch(`/alokasi/${editData!.id}`, data);
        toast.success("Alokasi berhasil diperbarui");
      } else {
        await api.post("/alokasi", { ...data, planningId });
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
              { label: "Daftar Planning", onClick: onNavigateToList },
              { label: projectName || "Proyek", onClick: onClose },
              { label: currentPageLabel },
            ]}
          />
          <h2 className="text-base font-semibold leading-snug">
            {isEdit ? "Edit Alokasi" : "Tambah Alokasi Baru"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isEdit
              ? "Perubahan akan tercatat di histori alokasi"
              : "Tambahkan alokasi anggaran untuk tahun tertentu"}
          </p>
        </SheetHeader>

        <SheetBody className="px-5 py-5 space-y-5">
          {loadingMaster ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* RO */}
              <div className="space-y-2">
                <Label>
                  RO (Rincian Output){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={watch("roId")}
                  onValueChange={(v) => setValue("roId", v)}
                  disabled={isEdit}
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Pilih RO" />
                  </SelectTrigger>
                  <SelectContent>
                    {roList.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        <span className="font-medium">
                          {r.kro.kegiatan.program.code} · {r.kro.code} ·{" "}
                          {r.code}
                        </span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          — {r.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.roId && (
                  <p className="text-destructive text-xs">
                    {errors.roId.message}
                  </p>
                )}
                {isEdit && (
                  <p className="text-xs text-muted-foreground">
                    RO tidak dapat diubah setelah dibuat
                  </p>
                )}
              </div>

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
                      {...register("outputTarget", { valueAsNumber: true })}
                    />
                    <Input
                      className="h-10 w-24 shrink-0"
                      placeholder="Satuan"
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
                      {...register("outcomeTarget", { valueAsNumber: true })}
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
          )}
        </SheetBody>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting || loadingMaster}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Simpan Perubahan" : "Tambah Alokasi"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
