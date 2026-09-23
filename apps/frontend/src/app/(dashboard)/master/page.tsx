"use client";

import { useState } from "react";
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

export default function MasterPage() {
  const [activeTab, setActiveTab] = useState("nomenklatur");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Master Data</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Kelola data referensi yang digunakan dalam sistem
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "balai" && <BalaiTab />}
        {activeTab === "nomenklatur" && <NomenklaturTab />}
        {activeTab === "wilayah-sungai" && <WilayahSungaiTab />}
        {activeTab === "form-proyek" && <FormProyekTab />}
        {activeTab === "pnppkp" && <PnppkpTab />}
        {activeTab === "tagging-renja" && <TaggingRenjaTab />}
        {activeTab === "sasaran" && <SasaranTab />}
      </div>
    </div>
  );
}
