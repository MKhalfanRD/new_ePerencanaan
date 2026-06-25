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
import api from "@/lib/api";
import { RO, Alokasi } from "@/types";

const schema = z.object({
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
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  planningId: string;
  editData?: Alokasi | null;
}

export function AlokasiFormDialog({
  open,
  onClose,
  onSuccess,
  planningId,
  editData,
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
        roId: editData.roId,
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

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="!max-w-2xl !w-[88vw] max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-7 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>
            {isEdit ? "Edit Alokasi" : "Tambah Alokasi Baru"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEdit
              ? "Perubahan akan tercatat di histori alokasi"
              : "Tambahkan alokasi anggaran untuk tahun tertentu"}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
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
              <div className="grid grid-cols-2 gap-4">
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
                      Tahun tidak dapat diubah
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
                      Status tidak dapat diubah
                    </p>
                  )}
                </div>
              </div>

              {/* Sumber dana */}
              <div className="space-y-2">
                <Label>Sumber Dana (Rp)</Label>
                <div className="grid grid-cols-5 gap-3">
                  {(["rm", "rmp", "pln", "sbsn", "kpbu"] as const).map((f) => (
                    <div key={f} className="space-y-1.5">
                      <p className="text-xs text-center text-muted-foreground uppercase font-medium">
                        {f}
                      </p>
                      <Input
                        type="number"
                        className="text-sm text-center h-10 px-2"
                        placeholder="0"
                        {...register(f, { valueAsNumber: true })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Output & Outcome */}
              <div className="grid grid-cols-2 gap-4">
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
                      className="h-10 w-28 shrink-0"
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
                      className="h-10 w-28 shrink-0"
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
        </div>

        <DialogFooter className="px-7 py-5 border-t shrink-0 bg-background">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
