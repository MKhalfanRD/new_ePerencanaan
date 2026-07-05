"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import api from "@/lib/api";
import { wilayahApi } from "@/lib/wilayah-api";
import { CascadingWilayah, WilayahValue } from "./cascading-wilayah";
import { LocationSearchBox } from "./location-search-box";
import type { TipeKoordinat } from "./map-picker";

// Dynamic import — Leaflet butuh window, tidak bisa SSR
const MapPicker = dynamic(
  () => import("./map-picker").then((m) => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] rounded-lg border flex items-center justify-center bg-muted/30">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

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
  /** Klik "Daftar Planning" di breadcrumb — kembali ke daftar (tutup semua lapis). */
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
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);

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

  const handlePointChange = async (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);

    setIsGeocoding(true);
    try {
      const geo = await wilayahApi.reverseGeocode(lat, lng);
      console.log("[reverseGeocode] hasil:", geo);
      setWilayah({
        provinceId: geo.provinceId,
        provinceName: geo.provinceName,
        cityId: geo.cityId,
        cityName: geo.cityName,
        districtId: geo.districtId,
        districtName: geo.districtName,
        villageId: geo.villageId,
        villageName: geo.villageName,
      });

      if (geo.matchedLevel === "village") {
        toast.success("Wilayah administratif otomatis terisi");
      } else if (geo.matchedLevel === "none") {
        toast.warning(
          "Wilayah tidak dapat dideteksi otomatis, silakan pilih manual",
        );
      } else {
        toast.info(
          "Sebagian wilayah terisi otomatis, silakan lengkapi sisanya",
        );
      }
    } catch (err) {
      console.error("[reverseGeocode] gagal:", err);
      toast.error(
        "Gagal mendeteksi wilayah otomatis, silakan pilih manual di bawah",
      );
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSearchSelect = (
    lat: number,
    lng: number,
    _displayName: string,
  ) => {
    setFlyTo({ lat, lng }); // pindahkan peta & marker
    handlePointChange(lat, lng); // reuse alur reverse-geocode yang sudah ada
  };

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
              { label: "Daftar Planning", onClick: onNavigateToList },
              { label: projectName || "Proyek", onClick: onClose },
              { label: currentPageLabel },
            ]}
          />
          <h2 className="text-base font-semibold leading-snug flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            {isEdit ? "Edit Lokasi" : "Tambah Lokasi Baru"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Tentukan lokasi di peta dan lengkapi informasi wilayah administratif
          </p>
        </SheetHeader>

        <SheetBody className="px-5 py-5 space-y-5">
          {tipeKoordinat === "TITIK" && (
            <LocationSearchBox onSelect={handleSearchSelect} />
          )}

          <MapPicker
            tipeKoordinat={tipeKoordinat}
            onTipeChange={setTipeKoordinat}
            latitude={latitude}
            longitude={longitude}
            coordinates={coordinates}
            onPointChange={handlePointChange}
            onShapeChange={setCoordinates}
            flyToTrigger={flyTo}
            height="260px"
          />

          {tipeKoordinat === "TITIK" && latitude && longitude && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Latitude</Label>
                <Input
                  className="h-9 text-xs"
                  value={latitude.toFixed(6)}
                  readOnly
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Longitude</Label>
                <Input
                  className="h-9 text-xs"
                  value={longitude.toFixed(6)}
                  readOnly
                />
              </div>
            </div>
          )}

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
              Wilayah Administratif
              {isGeocoding && (
                <span className="inline-flex items-center gap-1 normal-case tracking-normal font-normal text-muted-foreground/80">
                  <Loader2 size={11} className="animate-spin" />
                  Mendeteksi otomatis...
                </span>
              )}
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
