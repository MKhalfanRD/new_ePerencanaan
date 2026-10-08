"use client";

import React from "react";
import { BalaiTab } from "@/components/master/balai-tab";
import { NomenklaturTab } from "@/components/master/nomenklatur-tab";
import { WilayahSungaiTab } from "@/components/master/wilayah-sungai-tab";
import { PnppkpTab } from "@/components/master/pnppkp-tab";
import { SasaranTab } from "@/components/master/sasaran-tab";
import {
  FlatMasterTable,
  useFlatMaster,
} from "@/components/master/tagging-renja-tab";

/** Editor master per sumber pilihan (lihat option-sources.tsx) — komponen
 * yang SAMA dengan tab master-nya, dibuka dari kanvas Form Proyek. */
function flatEditor(endpoint: string, title: string) {
  return function FlatEditor() {
    const m = useFlatMaster(endpoint, title);
    return <FlatMasterTable title={title} m={m} />;
  };
}

export const SOURCE_EDITORS: Record<string, React.ComponentType> = {
  balai: BalaiTab,
  periode: NomenklaturTab,
  wilayahSungai: WilayahSungaiTab,
  sumberUsulan: flatEditor("/master/sumber-usulan-proyek", "Sumber Usulan Proyek"),
  pkpn: flatEditor("/master/pkpn", "PKPN"),
  tematikRenja: flatEditor("/master/tematik-renja", "Tematik RENJA"),
  taggingDinamis: flatEditor("/master/tagging-dinamis", "Tagging Dinamis"),
  kegiatanPrioritas: PnppkpTab,
  isp: SasaranTab,
  isk: SasaranTab,
  // RO / Komponen / Indikator RO & satuannya (lihat OPTION_SOURCES.editor).
  nomenklatur: NomenklaturTab,
  satuan: NomenklaturTab,
};
