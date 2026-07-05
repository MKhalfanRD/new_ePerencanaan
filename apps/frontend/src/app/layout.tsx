import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { Toaster } from "@/components/ui/sonner";

// Font disamakan dengan mockup (mockup-redesign-planning.html), yang
// stack-nya: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto,
// Helvetica, Arial, sans-serif. Inter di-load lewat next/font supaya
// tampilannya konsisten persis di semua OS/browser (tidak bergantung font
// sistem yang belum tentu terpasang), dengan urutan fallback yang sama
// seperti mockup kalau suatu saat Inter gagal termuat. Lihat globals.css
// untuk penyusunan stack lengkapnya (--font-sans).
// Mono tidak di-load sebagai webfont karena mockup memakai monospace
// bawaan sistem (ui-monospace) untuk kode-chip, bukan font kustom.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ePerencanaan",
  description: "Sistem Perencanaan Anggaran Terpadu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `inter.variable` sengaja ditaruh di <html>, bukan <body> — rule
    // `html { @apply font-sans }` di globals.css jalan di elemen <html>,
    // dan CSS custom property cuma bisa dibaca oleh elemen itu sendiri +
    // turunannya. Kalau variabelnya cuma ada di <body> (anak dari <html>),
    // <html> tidak bisa membacanya balik ke atas, sehingga font-family
    // jadi invalid dan jatuh ke default browser (kasus "Planning" jadi
    // serif yang dilaporkan sebelumnya).
    <html lang="id" className={inter.variable}>
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
