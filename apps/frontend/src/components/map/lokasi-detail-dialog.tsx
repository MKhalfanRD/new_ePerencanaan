"use client";

import dynamic from "next/dynamic";
import { Loader2, MapPin, ExternalLink, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const MapPicker = dynamic(
  () => import("./map-picker").then((m) => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] rounded-lg border flex items-center justify-center bg-muted/30">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

interface LokasiData {
  id: string;
  name?: string;
  tipeKoordinat: "TITIK" | "GARIS" | "POLIGON";
  latitude?: number;
  longitude?: number;
  coordinates?: number[][];
  provinceName?: string;
  cityName?: string;
  districtName?: string;
  villageName?: string;
  createdAt: string;
}

const tipeLabel = { TITIK: "Titik", GARIS: "Garis", POLIGON: "Poligon" };

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  data: LokasiData;
  canManage?: boolean;
}

export function LokasiDetailDialog({
  open,
  onClose,
  onEdit,
  onDelete,
  data,
  canManage,
}: Props) {
  const googleMapsUrl =
    data.latitude && data.longitude
      ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}`
      : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-2xl !w-[88vw] max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-7 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <MapPin size={18} className="text-primary" />
              {data.name || "Detail Lokasi"}
            </DialogTitle>
            {canManage && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={onEdit}>
                  <Edit size={13} className="mr-1.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 size={13} className="mr-1.5" /> Hapus
                </Button>
              </div>
            )}
          </div>
          <Badge variant="secondary" className="text-xs w-fit mt-1">
            {tipeLabel[data.tipeKoordinat]}
          </Badge>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
          <MapPicker
            tipeKoordinat={data.tipeKoordinat}
            onTipeChange={() => {}}
            latitude={data.latitude}
            longitude={data.longitude}
            coordinates={data.coordinates}
            readOnly
            height="280px"
          />

          {googleMapsUrl && (
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="w-full">
                <ExternalLink size={13} className="mr-2" /> Buka di Google Maps
              </Button>
            </a>
          )}

          <div className="rounded-lg border divide-y divide-border px-4">
            <InfoRow label="Provinsi" value={data.provinceName} />
            <InfoRow label="Kota/Kabupaten" value={data.cityName} />
            <InfoRow label="Kecamatan" value={data.districtName} />
            <InfoRow label="Desa/Kelurahan" value={data.villageName} />
            {data.latitude && data.longitude && (
              <InfoRow
                label="Koordinat"
                value={`${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`}
              />
            )}
            <InfoRow
              label="Ditambahkan"
              value={new Date(data.createdAt).toLocaleDateString("id-ID", {
                dateStyle: "long",
              })}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
