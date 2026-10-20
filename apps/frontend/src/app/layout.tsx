import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { Toaster } from "@/components/ui/sonner";

const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
    <html lang="id" className={`${instrument.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster richColors position="bottom-right" duration={2000} />
      </body>
    </html>
  );
}
