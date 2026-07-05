"use client";

import dynamic from "next/dynamic";
import { Loader2, MapPin, ExternalLink, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

const MapPicker = dynamic(
  () => import("./map-picker").then((m) => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[160px] rounded-lg border flex items-center justify-center bg-muted/30">
        <Loader2 className="animate-spin text-muted-foreground" size={16} />
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
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right max-w-[60%] truncate">
        {value}
      </span>
    </div>
  );
}

interface Props {
  /** Elemen pemicu — biasanya chip/kartu ringkas lokasi. */
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  data: LokasiData;
  canManage?: boolean;
}

/**
 * Detail Lokasi — popover kecil menumpang di lapis-1 (Fase 4), pengganti
 * `LokasiDetailDialog` (Dialog penuh) lama.
 *
 * Konsisten dengan aturan "maks 2 drawer terbuka bersamaan" (§3
 * design-concept-planning.md): chip lokasi ini sudah berada *di dalam*
 * Sheet lapis-1 (AlokasiExpandPanel), jadi "lihat detail" tidak butuh
 * drawer/Sheet baru — cukup popover. Hanya aksi **Edit** yang membuka
 * Sheet lapis-2 penuh (lewat `LokasiFormDialog`, tetap sama seperti sebelumnya).
 *
 * Catatan: ini adalah pilihan default yang disebutkan di
 * rencana-implementasi-redesign-drawer.md §Fase 4 ("Keputusan yang perlu
 * dikonfirmasi ke stakeholder") — belum ada konfirmasi eksplisit, jadi
 * dipilih opsi default (popover kecil) alih-alih Sheet lapis-2 penuh.
 */
export function LokasiDetailPopover({
  children,
  open,
  onOpenChange,
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
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-96">
        <div className="px-4 pt-4 pb-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold flex items-center gap-1.5 truncate">
              <MapPin size={14} className="text-primary shrink-0" />
              <span className="truncate">{data.name || "Detail Lokasi"}</span>
            </p>
            <Badge variant="secondary" className="text-xs shrink-0">
              {tipeLabel[data.tipeKoordinat]}
            </Badge>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          <MapPicker
            tipeKoordinat={data.tipeKoordinat}
            onTipeChange={() => {}}
            latitude={data.latitude}
            longitude={data.longitude}
            coordinates={data.coordinates}
            readOnly
            height="160px"
          />

          {googleMapsUrl && (
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="w-full h-8 text-xs">
                <ExternalLink size={12} className="mr-1.5" /> Buka di Google
                Maps
              </Button>
            </a>
          )}

          <div className="rounded-lg border divide-y divide-border px-3">
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
                dateStyle: "medium",
              })}
            />
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2 px-4 py-3 border-t">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={onEdit}
            >
              <Edit size={12} className="mr-1.5" /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 size={12} className="mr-1.5" /> Hapus
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
