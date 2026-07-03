"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Spline, Pentagon, Trash2, Locate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TipeKoordinat = "TITIK" | "GARIS" | "POLIGON";

interface MapPickerProps {
  tipeKoordinat: TipeKoordinat;
  onTipeChange: (tipe: TipeKoordinat) => void;
  latitude?: number;
  longitude?: number;
  coordinates?: number[][]; // untuk GARIS/POLIGON
  onPointChange?: (lat: number, lng: number) => void;
  onShapeChange?: (coords: number[][]) => void;
  height?: string;
  readOnly?: boolean;
  flyToTrigger?: { lat: number; lng: number } | null;
}

// Default center: Indonesia
const DEFAULT_CENTER: [number, number] = [-2.5489, 118.0149];
const DEFAULT_ZOOM = 5;

export function MapPicker({
  tipeKoordinat,
  onTipeChange,
  latitude,
  longitude,
  coordinates,
  onPointChange,
  onShapeChange,
  height = "320px",
  readOnly = false,
  flyToTrigger,
}: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Init map sekali saja
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let L: any;
    let cancelled = false;

    (async () => {
      L = (await import("leaflet")).default;
      // React Strict Mode (dev) menjalankan effect ini 2x secara berurutan;
      // cek ulang di setiap titik `await` supaya tidak membuat 2 instance peta
      // di container DOM yang sama ("Map container is already initialized").
      if (cancelled || mapRef.current) return;

      // leaflet-draw mengharapkan window.L tersedia secara global sebelum di-import
      (window as any).L = L;
      await import("leaflet-draw");
      if (cancelled || mapRef.current) return;

      // Fix icon path issue dengan Leaflet di Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const initialCenter: [number, number] =
        latitude && longitude ? [latitude, longitude] : DEFAULT_CENTER;
      const initialZoom = latitude && longitude ? 13 : DEFAULT_ZOOM;

      const map = L.map(mapContainerRef.current!, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: !readOnly,
        dragging: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);
      drawnItemsRef.current = drawnItems;
      mapRef.current = map;

      // Render existing data
      if (tipeKoordinat === "TITIK" && latitude && longitude) {
        const marker = L.marker([latitude, longitude], {
          draggable: !readOnly,
        });
        marker.addTo(drawnItems);
        layerRef.current = marker;
        if (!readOnly) {
          marker.on("dragend", (e: any) => {
            const pos = e.target.getLatLng();
            onPointChange?.(pos.lat, pos.lng);
          });
        }
      } else if (
        (tipeKoordinat === "GARIS" || tipeKoordinat === "POLIGON") &&
        coordinates &&
        coordinates.length > 0
      ) {
        const layer =
          tipeKoordinat === "GARIS"
            ? L.polyline(coordinates as any, { color: "#2563eb", weight: 3 })
            : L.polygon(coordinates as any, {
                color: "#2563eb",
                weight: 2,
                fillOpacity: 0.2,
              });
        layer.addTo(drawnItems);
        layerRef.current = layer;
        map.fitBounds(layer.getBounds());
      }

      // Klik di peta untuk tipe TITIK (mode edit)
      if (!readOnly && tipeKoordinat === "TITIK") {
        map.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          drawnItems.clearLayers();
          const marker = L.marker([lat, lng], { draggable: true });
          marker.addTo(drawnItems);
          layerRef.current = marker;
          marker.on("dragend", (ev: any) => {
            const pos = ev.target.getLatLng();
            onPointChange?.(pos.lat, pos.lng);
          });
          onPointChange?.(lat, lng);
        });
      }

      // Leaflet Draw controls untuk GARIS/POLIGON (mode edit)
      if (
        !readOnly &&
        (tipeKoordinat === "GARIS" || tipeKoordinat === "POLIGON")
      ) {
        map.on((L as any).Draw.Event.CREATED, (e: any) => {
          drawnItems.clearLayers();
          const layer = e.layer;
          layer.addTo(drawnItems);
          layerRef.current = layer;

          const latlngs =
            tipeKoordinat === "POLIGON"
              ? layer.getLatLngs()[0]
              : layer.getLatLngs();
          const coords = latlngs.map((p: any) => [p.lat, p.lng]);
          onShapeChange?.(coords);
        });
      }

      setIsReady(true);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isReady || !mapRef.current || !flyToTrigger || readOnly) return;
    if (tipeKoordinat !== "TITIK") return;

    const { lat, lng } = flyToTrigger;
    mapRef.current.setView([lat, lng], 15);

    (async () => {
      const L = (await import("leaflet")).default;
      if (!drawnItemsRef.current) return;
      drawnItemsRef.current.clearLayers();
      const marker = L.marker([lat, lng], { draggable: true });
      marker.addTo(drawnItemsRef.current);
      layerRef.current = marker;
      marker.on("dragend", (e: any) => {
        const pos = e.target.getLatLng();
        onPointChange?.(pos.lat, pos.lng);
      });
      onPointChange?.(lat, lng);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToTrigger]);

  const handleLocateMe = () => {
    if (!mapRef.current) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        mapRef.current.setView([lat, lng], 15);
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { timeout: 8000 },
    );
  };

  const handleClearDrawing = async () => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
      layerRef.current = null;
      onShapeChange?.([]);
    }
  };

  // Start drawing mode untuk GARIS/POLIGON
  const startDrawing = async () => {
    if (!mapRef.current) return;
    const L = (await import("leaflet")).default;

    handleClearDrawing();

    const DrawHandler =
      tipeKoordinat === "GARIS"
        ? new (L as any).Draw.Polyline(mapRef.current, {
            shapeOptions: { color: "#2563eb", weight: 3 },
          })
        : new (L as any).Draw.Polygon(mapRef.current, {
            shapeOptions: { color: "#2563eb", weight: 2, fillOpacity: 0.2 },
          });

    DrawHandler.enable();
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5 p-1 bg-muted/60 rounded-lg w-fit">
            {[
              { value: "TITIK" as const, label: "Titik", icon: MapPin },
              { value: "GARIS" as const, label: "Garis", icon: Spline },
              { value: "POLIGON" as const, label: "Poligon", icon: Pentagon },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => onTipeChange(opt.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  tipeKoordinat === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <opt.icon size={13} /> {opt.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {(tipeKoordinat === "GARIS" || tipeKoordinat === "POLIGON") && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={startDrawing}
              >
                {tipeKoordinat === "GARIS" ? (
                  <Spline size={13} className="mr-1.5" />
                ) : (
                  <Pentagon size={13} className="mr-1.5" />
                )}
                Gambar {tipeKoordinat === "GARIS" ? "Garis" : "Poligon"}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={handleClearDrawing}
            >
              <Trash2 size={13} className="mr-1.5" /> Hapus
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={handleLocateMe}
              disabled={isLocating}
            >
              <Locate size={13} className="mr-1.5" />{" "}
              {isLocating ? "Mencari..." : "Lokasi Saya"}
            </Button>
          </div>
        </div>
      )}

      <div
        ref={mapContainerRef}
        style={{ height }}
        className="w-full rounded-lg border overflow-hidden z-0"
      />

      {!readOnly && tipeKoordinat === "TITIK" && (
        <p className="text-xs text-muted-foreground">
          💡 Klik di peta untuk menentukan titik lokasi, atau geser marker untuk
          menyesuaikan.
        </p>
      )}
      {!readOnly &&
        (tipeKoordinat === "GARIS" || tipeKoordinat === "POLIGON") && (
          <p className="text-xs text-muted-foreground">
            💡 Klik &quot;Gambar{" "}
            {tipeKoordinat === "GARIS" ? "Garis" : "Poligon"}&quot; lalu klik
            beberapa titik di peta untuk membentuk{" "}
            {tipeKoordinat === "GARIS" ? "garis" : "area"}.
          </p>
        )}
    </div>
  );
}
