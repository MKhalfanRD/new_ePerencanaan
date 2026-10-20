"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

import { BalaiTab } from "@/components/master/balai-tab";
import { NomenklaturTab } from "@/components/master/nomenklatur-tab";
import { WilayahSungaiTab } from "@/components/master/wilayah-sungai-tab";
import { FormProyekTab } from "@/components/master/form-proyek-tab";
import { PnppkpTab } from "@/components/master/pnppkp-tab";
import { TaggingRenjaTab } from "@/components/master/tagging-renja-tab";
import { SasaranTab } from "@/components/master/sasaran-tab";
import { ProvinsiTab } from "@/components/master/provinsi-tab";
import { KategoriProyekTab } from "@/components/master/kategori-proyek-tab";

// Program/Kegiatan/KRO/RO/IRO/Komponen/Tahun jadi SATU halaman
// ("Nomenklatur") — tab "Periode" lama dilebur ke sana sebagai bagian
// "Tahun" supaya seluruh hierarki terbaca sekaligus.
const tabs = [
  { id: "nomenklatur", label: "Nomenklatur" },
  { id: "balai", label: "Balai" },
  { id: "wilayah-sungai", label: "Wilayah Sungai" },
  { id: "provinsi", label: "Provinsi" },
  { id: "kategori-proyek", label: "Kategori Proyek" },
  { id: "form-proyek", label: "Form Proyek" },
  { id: "pnppkp", label: "PN / PP / KP" },
  { id: "tagging-renja", label: "Tagging RENJA" },
  { id: "sasaran", label: "Sasaran SP / SK" },
];

const TAB_IDS = tabs.map((t) => t.id);

export default function MasterPage() {
  return (
    <Suspense>
      <MasterPageInner />
    </Suspense>
  );
}

function MasterPageInner() {
  const searchParams = useSearchParams();
  // Deep-link dari Log Aktivitas (`/master?tab=...`) — buka tab yang sesuai
  // dengan resource yang baru diubah.
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab && TAB_IDS.includes(tab) ? tab : "nomenklatur";
  });
  const initialKegiatanId = searchParams.get("kegiatanId") ?? undefined;

  return (
    <div className="space-y-5">
      {/* Kepala halaman: judul + menu teks bergaris bawah (hi-fi HfMasterTabel). */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Master data</h1>
        <nav
          aria-label="Menu Master Data"
          className="mt-3 flex gap-1 overflow-x-auto border-b [scrollbar-width:none]"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "-mb-px flex h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-2.5 text-[14.5px] transition-colors",
                activeTab === tab.id
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "balai" && <BalaiTab />}
        {activeTab === "nomenklatur" && <NomenklaturTab />}
        {activeTab === "wilayah-sungai" && <WilayahSungaiTab />}
        {activeTab === "provinsi" && <ProvinsiTab />}
        {activeTab === "kategori-proyek" && <KategoriProyekTab />}
        {activeTab === "form-proyek" && (
          <FormProyekTab initialKegiatanId={initialKegiatanId} />
        )}
        {activeTab === "pnppkp" && <PnppkpTab />}
        {activeTab === "tagging-renja" && <TaggingRenjaTab />}
        {activeTab === "sasaran" && <SasaranTab />}
      </div>
    </div>
  );
}
