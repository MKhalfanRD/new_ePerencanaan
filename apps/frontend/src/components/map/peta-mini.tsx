"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Proyek } from "@/types";

export interface LokasiRingkas {
  id: string;
  projectName: string;
  status: Proyek["status"];
  tipeKoordinat: "TITIK" | "GARIS" | "POLIGON";
  latitude: number | null;
  longitude: number | null;
  coordinates: number[][] | null;
}

// Hex token status (globals.css --color-st-*) — atribut SVG Leaflet tidak bisa var().
const WARNA: Record<Proyek["status"], string> = {
  DRAFT: "#8a847f",
  DIAJUKAN: "#5759a6",
  DIPERIKSA: "#b68b16",
  DIKEMBALIKAN: "#b63132",
  APPROVED: "#2e7c35",
};
const INDONESIA: [number, number] = [-2.5489, 118.0149];

/** Peta kecil Dashboard (hi-fi "Sekilas lokasi"): lokasi tiap proyek, warna = status, klik = buka detail. */
export function PetaMini({ lokasi }: { lokasi: LokasiRingkas[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let batal = false;
    let peta: import("leaflet").Map | null = null;
    let amati: ResizeObserver | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (batal || !ref.current) return;
      peta = L.map(ref.current, { center: INDONESIA, zoom: 4, zoomControl: false, scrollWheelZoom: false, attributionControl: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(peta);

      const grup = L.featureGroup().addTo(peta);
      lokasi.forEach((x, i) => {
        const warna = WARNA[x.status];
        // Muncul bergiliran (animasi CSS .peta-titik, lihat globals.css).
        const gaya = { color: warna, fillColor: warna, className: "peta-titik" };
        // Garis/poligon tetap digambar, plus titik di tengahnya: di skala nasional
        // bentuknya bisa cuma beberapa piksel, jadi titiklah yang terlihat & diklik.
        const bentuk =
          x.coordinates?.length && x.tipeKoordinat !== "TITIK"
            ? x.tipeKoordinat === "GARIS"
              ? L.polyline(x.coordinates as [number, number][], { ...gaya, weight: 3 })
              : L.polygon(x.coordinates as [number, number][], { ...gaya, weight: 2, fillOpacity: 0.25 })
            : null;
        const pusat = bentuk ? bentuk.getBounds().getCenter() : L.latLng(x.latitude!, x.longitude!);
        const titik = L.circleMarker(pusat, { ...gaya, radius: 7, weight: 2, fillOpacity: 0.85 });
        for (const layer of bentuk ? [bentuk, titik] : [titik])
          layer
            .bindTooltip(x.projectName, { direction: "top" })
            .on("click", () => router.push(`/proyek?id=${x.id}`))
            .on("add", (e) => {
              const el = (e.target as { getElement?: () => Element | undefined }).getElement?.();
              if (el instanceof SVGElement) el.style.animationDelay = `${i * 90}ms`;
            })
            .addTo(grup);
      });
      // Ukuran kartu baru final setelah tata letak selesai → hitung ulang & paskan lagi.
      const paskan = () => {
        peta?.invalidateSize();
        if (lokasi.length) peta?.fitBounds(grup.getBounds(), { padding: [28, 28], maxZoom: 9 });
      };
      paskan();
      amati = new ResizeObserver(paskan);
      amati.observe(ref.current);
    })();
    return () => {
      batal = true;
      amati?.disconnect();
      peta?.remove();
    };
  }, [lokasi, router]);

  return <div ref={ref} className="h-full min-h-48 w-full overflow-hidden rounded-xl border" role="img" aria-label={`Peta ${lokasi.length} lokasi proyek`} />;
}
