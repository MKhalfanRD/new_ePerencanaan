"use client";

import { FlatMasterTable, useFlatMaster } from "./tagging-renja-tab";

/**
 * Master Provinsi (tabel wilayah_provinces) — dipakai Lokasi RO per paket
 * di tab Pemaketan & dropdown wilayah Lokasi Proyek. Provinsi yang masih
 * punya kabupaten/kota tidak bisa dihapus (ditolak backend).
 */
export function ProvinsiTab() {
  const provinsi = useFlatMaster("/master/provinsi", "Provinsi");
  return <FlatMasterTable title="Provinsi" m={provinsi} />;
}
