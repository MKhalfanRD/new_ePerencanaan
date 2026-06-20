"use client";

import { useState } from "react";
import {
  Building2,
  Calendar,
  BookOpen,
  FolderTree,
  Target,
  Flag,
  Droplets,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { BalaiTab } from "@/components/master/balai-tab";
import { PeriodeTab } from "@/components/master/periode-tab";
import { NomenklaturTab } from "@/components/master/nomenklatur-tab";
import { MajorProjectTab } from "@/components/master/major-project-tab";
import { TindakLanjutTab } from "@/components/master/tindak-lanjut-tab";
import { WilayahSungaiTab } from "@/components/master/wilayah-sungai-tab";

const tabs = [
  { id: "balai", label: "Balai", icon: Building2 },
  { id: "periode", label: "Periode", icon: Calendar },
  { id: "nomenklatur", label: "Nomenklatur", icon: FolderTree },
  { id: "major-project", label: "Major Project", icon: Flag },
  { id: "tindak-lanjut", label: "Tindak Lanjut", icon: AlertTriangle },
  { id: "wilayah-sungai", label: "Wilayah Sungai", icon: Droplets },
];

export default function MasterPage() {
  const [activeTab, setActiveTab] = useState("balai");

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
        {activeTab === "periode" && <PeriodeTab />}
        {activeTab === "nomenklatur" && <NomenklaturTab />}
        {activeTab === "major-project" && <MajorProjectTab />}
        {activeTab === "tindak-lanjut" && <TindakLanjutTab />}
        {activeTab === "wilayah-sungai" && <WilayahSungaiTab />}
      </div>
    </div>
  );
}
