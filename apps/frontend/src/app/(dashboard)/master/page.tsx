"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  FolderTree,
  Droplets,
  ClipboardCheck,
  Target,
  Tags,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { BalaiTab } from "@/components/master/balai-tab";
import { NomenklaturTab } from "@/components/master/nomenklatur-tab";
import { WilayahSungaiTab } from "@/components/master/wilayah-sungai-tab";
import { FormProyekTab } from "@/components/master/form-proyek-tab";
import { PnppkpTab } from "@/components/master/pnppkp-tab";
import { TaggingRenjaTab } from "@/components/master/tagging-renja-tab";
import { SasaranTab } from "@/components/master/sasaran-tab";

// Program/Kegiatan/KRO/RO/IRO/Komponen/Tahun jadi SATU halaman
// ("Nomenklatur") — tab "Periode" lama dilebur ke sana sebagai bagian
// "Tahun" supaya seluruh hierarki terbaca sekaligus.
const tabs = [
  { id: "nomenklatur", label: "Nomenklatur", icon: FolderTree },
  { id: "balai", label: "Balai", icon: Building2 },
  { id: "wilayah-sungai", label: "Wilayah Sungai", icon: Droplets },
  { id: "form-proyek", label: "Form Proyek", icon: ClipboardCheck },
  { id: "pnppkp", label: "PN / PP / KP", icon: Target },
  { id: "tagging-renja", label: "Tagging RENJA", icon: Tags },
  { id: "sasaran", label: "Sasaran SP / SK", icon: Flag },
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
    <div className="space-y-6">
      {/* Kepala halaman: strip putih selebar konten (menembus padding layout)
          dengan menu bergaris bawah, seperti prototipe builder. */}
      <div className="-mx-6 -mt-6 border-b border-[#d0d7de] bg-white px-6 pt-5">
        <h1 className="text-2xl font-bold tracking-tight">Master Data</h1>
        <nav aria-label="Menu Master Data" className="mt-3 flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex h-12 items-center gap-2 border-b-[3px] px-3 text-sm transition-colors",
                activeTab === tab.id
                  ? "border-primary font-bold text-primary"
                  : "border-transparent font-medium text-[#3d4752] hover:text-foreground",
              )}
            >
              <tab.icon size={15} />
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
