"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetBreadcrumb,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import api from "@/lib/api";
import { CascadingWilayah, WilayahValue } from "./cascading-wilayah";
import { LokasiPeta } from "./lokasi-peta";
import type { TipeKoordinat } from "./map-picker";

interface LokasiData {
  id: string;
  name?: string;
  tipeKoordinat: TipeKoordinat;
  latitude?: number;
  longitude?: number;
  coordinates?: number[][];
  provinceId?: string;
  provinceName?: string;
  cityId?: string;
  cityName?: string;
  districtId?: string;
  districtName?: string;
  villageId?: string;
  villageName?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  alokasiId: string;
  editData?: LokasiData | null;
  /** Nama proyek — dipakai di breadcrumb header (Sheet lapis-2, Fase 4). */
  projectName?: string;
  /** Klik "Daftar Proyek" di breadcrumb — kembali ke daftar (tutup semua lapis). */
  onNavigateToList?: () => void;
}

export function LokasiFormDialog({
  open,
  onClose,
  onSuccess,
  alokasiId,
  editData,
  projectName,
  onNavigateToList,
}: Props) {
  const [tipeKoordinat, setTipeKoordinat] = useState<TipeKoordinat>("TITIK");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [coordinates, setCoordinates] = useState<number[][]>([]);
  const [wilayah, setWilayah] = useState<WilayahValue>({});
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editData;

  useEffect(() => {
    if (editData) {
      setTipeKoordinat(editData.tipeKoordinat);
      setLatitude(editData.latitude);
      setLongitude(editData.longitude);
      setCoordinates(editData.coordinates || []);
      setWilayah({
        provinceId: editData.provinceId,
        provinceName: editData.provinceName,
        cityId: editData.cityId,
        cityName: editData.cityName,
        districtId: editData.districtId,
        districtName: editData.districtName,
        villageId: editData.villageId,
        villageName: editData.villageName,
      });
    } else {
      setTipeKoordinat("TITIK");
      setLatitude(undefined);
      setLongitude(undefined);
      setCoordinates([]);
      setWilayah({});
    }
  }, [editData, open]);

  const handleSubmit = async () => {
    if (tipeKoordinat === "TITIK" && (!latitude || !longitude)) {
      return toast.error("Silakan tentukan titik lokasi di peta");
    }
    if (
      (tipeKoordinat === "GARIS" || tipeKoordinat === "POLIGON") &&
      coordinates.length < 2
    ) {
      return toast.error(
        `Silakan gambar ${tipeKoordinat === "GARIS" ? "garis" : "poligon"} di peta`,
      );
    }

    setSubmitting(true);
    try {
      const payload = {
        tipeKoordinat,
        latitude: tipeKoordinat === "TITIK" ? latitude : undefined,
        longitude: tipeKoordinat === "TITIK" ? longitude : undefined,
        coordinates: tipeKoordinat !== "TITIK" ? coordinates : undefined,
        ...wilayah,
      };

      if (isEdit) {
        await api.patch(`/alokasi/lokasi/${editData!.id}`, payload);
        toast.success("Lokasi berhasil diperbarui");
      } else {
        await api.post(`/alokasi/${alokasiId}/lokasi`, payload);
        toast.success("Lokasi berhasil ditambahkan");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  const currentPageLabel = isEdit ? "Edit Lokasi" : "Tambah Lokasi";

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
          <SheetTitle className="text-base leading-snug flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            {isEdit ? "Edit Lokasi" : "Tambah Lokasi Baru"}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Tentukan lokasi di peta dan lengkapi informasi wilayah administratif
          </p>
        </SheetHeader>

        <SheetBody className="px-5 py-5 space-y-5">
          <LokasiPeta
            value={{ tipeKoordinat, latitude, longitude, coordinates }}
            onChange={(p) => {
              if (p.tipeKoordinat) setTipeKoordinat(p.tipeKoordinat);
              if (p.latitude !== undefined) setLatitude(p.latitude);
              if (p.longitude !== undefined) setLongitude(p.longitude);
              if (p.coordinates) setCoordinates(p.coordinates);
            }}
            onWilayahDetected={setWilayah}
          />

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Wilayah Administratif
            </p>
            <CascadingWilayah value={wilayah} onChange={setWilayah} />
          </div>
        </SheetBody>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Simpan Perubahan" : "Tambah Lokasi"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
