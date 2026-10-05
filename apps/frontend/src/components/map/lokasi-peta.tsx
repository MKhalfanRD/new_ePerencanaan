"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { wilayahApi } from "@/lib/wilayah-api";
import type { WilayahValue } from "./cascading-wilayah";
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

export interface LokasiPetaValue {
  tipeKoordinat: TipeKoordinat;
  latitude?: number;
  longitude?: number;
  coordinates: number[][];
}

/**
 * Peta lokasi (cari tempat + titik/garis/poligon + daftar koordinat) —
 * dipakai dialog Lokasi Alokasi & tab Lokasi Proyek supaya keduanya sama
 * persis. Klik titik -> reverse geocode -> `onWilayahDetected`.
 */
export function LokasiPeta({
  value,
  onChange,
  onWilayahDetected,
  readOnly = false,
  height = "260px",
}: {
  value: LokasiPetaValue;
  onChange: (patch: Partial<LokasiPetaValue>) => void;
  onWilayahDetected: (wilayah: WilayahValue) => void;
  readOnly?: boolean;
  height?: string;
}) {
  const { tipeKoordinat, latitude, longitude, coordinates } = value;
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);

  const handlePointChange = async (lat: number, lng: number) => {
    onChange({ latitude: lat, longitude: lng });

    setIsGeocoding(true);
    try {
      const geo = await wilayahApi.reverseGeocode(lat, lng);
      onWilayahDetected({
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
        "Gagal mendeteksi wilayah otomatis, silakan pilih manual",
      );
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSearchSelect = (lat: number, lng: number) => {
    setFlyTo({ lat, lng }); // pindahkan peta & marker
    handlePointChange(lat, lng);
  };

  return (
    <div className="space-y-5">
      {!readOnly && tipeKoordinat === "TITIK" && (
        <LocationSearchBox onSelect={handleSearchSelect} />
      )}

      <MapPicker
        tipeKoordinat={tipeKoordinat}
        onTipeChange={(t) => onChange({ tipeKoordinat: t })}
        latitude={latitude}
        longitude={longitude}
        coordinates={coordinates}
        onPointChange={handlePointChange}
        onShapeChange={(c) => onChange({ coordinates: c })}
        flyToTrigger={flyTo}
        height={height}
        readOnly={readOnly}
      />

      {isGeocoding && (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Loader2 size={11} className="animate-spin" />
          Mendeteksi wilayah otomatis...
        </p>
      )}

      {tipeKoordinat === "TITIK" && latitude && longitude && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Latitude</Label>
            <Input className="h-9 text-xs" value={latitude.toFixed(6)} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Longitude</Label>
            <Input className="h-9 text-xs" value={longitude.toFixed(6)} readOnly />
          </div>
        </div>
      )}

      {/* Garis/Poligon tidak punya satu lat/long — yang disimpan &
          ditampilkan adalah SELURUH titik yang digambar (array [lat,lng]
          per titik), ditampilkan sebagai daftar supaya kelihatan datanya
          benar-benar bertambah tiap klik di peta. */}
      {(tipeKoordinat === "GARIS" || tipeKoordinat === "POLIGON") &&
        coordinates.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">{coordinates.length} Titik Koordinat</Label>
            <div className="max-h-24 overflow-y-auto rounded-lg border text-xs divide-y">
              {coordinates.map(([lat, lng], i) => (
                <div
                  key={i}
                  className="flex justify-between px-2.5 py-1.5 text-muted-foreground"
                >
                  <span>#{i + 1}</span>
                  <span>
                    {lat.toFixed(6)}, {lng.toFixed(6)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
