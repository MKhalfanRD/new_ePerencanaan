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
  const leafletRef = useRef<any>(null);
  // Handler leaflet-draw yang sedang aktif (mode "sedang menggambar"). Perlu
  // dilacak supaya bisa di-disable() secara eksplisit — leaflet-draw taruh
  // vertex/garis bantu SELAMA menggambar langsung di peta, DI LUAR
  // drawnItemsRef, jadi drawnItems.clearLayers() tidak menyentuhnya. Tanpa
  // ini, pindah tab Garis->Poligon di tengah gambar menyisakan garis bantu
  // lama ikut nempel ke gambar baru.
  const drawHandlerRef = useRef<any>(null);
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
      leafletRef.current = L;
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

      // Binding klik-untuk-TITIK / Draw.Event.CREATED dipindah ke effect
      // terpisah di bawah (keyed on tipeKoordinat) — supaya kalau user
      // ganti tab Titik/Garis/Poligon SETELAH peta ini mount, handler-nya
      // ikut diganti, bukan nyangkut permanen di tipe awal saat mount.
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

  // Bind ulang interaksi peta tiap kali tab Titik/Garis/Poligon berganti.
  // Sebelumnya binding ini ada di effect init (jalan sekali saat mount) —
  // akibatnya kalau user ganti tab SETELAH peta terbuka, handler klik lama
  // (mis. klik-untuk-titik) tetap aktif bersamaan dengan leaflet-draw,
  // saling menimpa (drawnItems.clearLayers() dari handler lama menghapus
  // vertex yang baru digambar leaflet-draw di klik berikutnya) — makanya
  // menggambar garis/poligon kelihatan tidak pernah "jadi", dan tombol
  // Hapus/Tambah Lokasi kelihatan tidak berubah karena datanya memang
  // sudah kosong duluan.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    const drawnItems = drawnItemsRef.current;
    if (!isReady || !map || !L || !drawnItems || readOnly) return;

    map.off("click");
    map.off(L.Draw.Event.CREATED);

    if (tipeKoordinat === "TITIK") {
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
    } else {
      map.on(L.Draw.Event.CREATED, (e: any) => {
        drawnItems.clearLayers();
        const layer = e.layer;
        layer.addTo(drawnItems);
        layerRef.current = layer;
        // Handler leaflet-draw men-disable dirinya sendiri begitu satu
        // bentuk selesai (repeatMode: false, default) — samakan ref-nya.
        drawHandlerRef.current = null;

        const latlngs =
          tipeKoordinat === "POLIGON"
            ? layer.getLatLngs()[0]
            : layer.getLatLngs();
        const coords = latlngs.map((p: any) => [p.lat, p.lng]);
        onShapeChange?.(coords);
      });

      // Langsung aktifkan mode gambar begitu tab Garis/Poligon dipilih — tidak
      // ada lagi tombol "Gambar Garis/Poligon" terpisah, tinggal klik di peta.
      // Hanya untuk lokasi BARU (drawnItems masih kosong) — kalau lagi edit
      // lokasi yang sudah punya bentuk, jangan langsung masuk mode gambar,
      // supaya klik di peta tidak tanpa sengaja menimpa data lama.
      if (drawnItems.getLayers().length === 0) {
        armDrawing(tipeKoordinat);
      }
    }

    return () => {
      map.off("click");
      map.off(L.Draw.Event.CREATED);
      // Matikan handler gambar yang masih aktif SEBELUM tab berganti lagi —
      // ini yang menghapus vertex/garis bantu setengah-jadi supaya tidak
      // ikut nempel ke gambar tipe berikutnya.
      drawHandlerRef.current?.disable();
      drawHandlerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, tipeKoordinat, readOnly]);

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

  // Aktifkan mode gambar leaflet-draw untuk GARIS/POLIGON. Selalu disable()
  // handler lama dulu — kalau ada gambar setengah-jadi, ini yang membuang
  // vertex/garis bantunya sebelum handler baru mulai.
  const armDrawing = (type: "GARIS" | "POLIGON") => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    drawHandlerRef.current?.disable();
    const DrawHandler =
      type === "GARIS"
        ? new L.Draw.Polyline(map, { shapeOptions: { color: "#2563eb", weight: 3 } })
        : new L.Draw.Polygon(map, {
            shapeOptions: { color: "#2563eb", weight: 2, fillOpacity: 0.2 },
          });
    DrawHandler.enable();
    drawHandlerRef.current = DrawHandler;
  };

  const handleClearDrawing = () => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
      layerRef.current = null;
      onShapeChange?.([]);
    }
    // Tidak ada lagi tombol "Gambar Garis/Poligon" — Hapus sekaligus
    // mengaktifkan ulang mode gambar supaya user langsung bisa menggambar
    // lagi tanpa tombol tambahan.
    if (tipeKoordinat === "GARIS" || tipeKoordinat === "POLIGON") {
      armDrawing(tipeKoordinat);
    }
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2">
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

          <div className="flex flex-wrap gap-2">
            {/* Tombol "Gambar Garis/Poligon" dibuang — mode gambar otomatis
                aktif begitu tab Garis/Poligon dipilih (lihat effect di atas),
                dan "Hapus" sudah mengaktifkan ulang mode gambar juga. */}
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
            💡 Klik beberapa titik di peta untuk membentuk{" "}
            {tipeKoordinat === "GARIS" ? "garis" : "area"}, lalu klik titik
            pertama lagi (atau dobel-klik) untuk menutupnya.
          </p>
        )}
    </div>
  );
}
