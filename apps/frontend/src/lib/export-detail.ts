import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { statusConfig } from "@/components/shared/status-config";
import type { IsiBaris } from "@/components/proyek/isi-usulan";
import type { Proyek } from "@/types";

/**
 * Export detail proyek (flowchart-export-detail.pdf, keputusan 21 Okt):
 * isi = layar detail. Ringkasan + Isi usulan (template kegiatan) + Paket per
 * tahun (rencana & realisasi). Angka penuh, kolom kosong "–", tanpa catatan
 * pemeriksaan & riwayat.
 */
const SD = ["rm", "rmp", "pln", "sbsn", "kpbu"] as const;
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const tgl = (d: string | Date) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function ringkasan(p: Proyek, pencetak: string): [string, string][] {
  const semua = (p.paket ?? []).flatMap((pk) => pk.alokasi ?? []);
  const jumlah = (st: string) => semua.filter((a) => a.status === st).reduce((s, a) => s + Number(a.total), 0);
  return [
    ["Nama proyek", p.projectName],
    ["Kode proyek", p.kodeProyek ?? "–"],
    ["Kegiatan", p.kegiatan ? `${p.kegiatan.code} · ${p.kegiatan.name}` : "–"],
    ["Balai", p.balai.name],
    ["Periode", p.periode.label],
    ["Status", statusConfig[p.status as keyof typeof statusConfig]?.label ?? p.status],
    ["Skor evaluasi", p.skorEvaluasi != null ? `${(Number(p.skorEvaluasi) * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })} / 100` : "–"],
    ["Total rencana", rp(jumlah("RENCANA"))],
    ["Total realisasi", jumlah("REALISASI") ? rp(jumlah("REALISASI")) : "–"],
    ["Dibuat oleh", `${p.createdBy?.name ?? "–"} · ${tgl(p.createdAt)}`],
    ["Dicetak oleh", `${pencetak} · ${new Date().toLocaleString("id-ID")}`],
  ];
}

const KEPALA_PAKET = ["Paket", "Satker", "KRO/RO", "Indikator RO", "Lokasi RO", "Tahun", "Komponen", "Vol RO", "Vol IRO", "RM", "RMP", "PLN", "SBSN", "KPBU", "Rencana", "Realisasi"];
const KOLOM_ANGKA = 9; // indeks pertama kolom rupiah (RM)

/** Satu baris per paket per tahun rencana; baris terakhir = total. Rupiah = angka (null = "–"). */
function barisPaket(p: Proyek, namaProvinsi: Record<string, string>): (string | number | null)[][] {
  const out: (string | number | null)[][] = [];
  const total = Array(7).fill(0) as number[];
  for (const pk of p.paket ?? []) {
    const rencana = (pk.alokasi ?? []).filter((a) => a.status === "RENCANA").sort((a, b) => a.tahun - b.tahun);
    // Paket tanpa alokasi tetap tercantum (di layar: "Belum ada alokasi anggaran").
    if (!rencana.length)
      out.push([pk.name, pk.satker?.name ?? "–", pk.ro ? `${pk.ro.kro.code}.${pk.ro.code} ${pk.ro.name}` : "–", "–", "–", "–", "Belum ada alokasi", "–", "–", null, null, null, null, null, null, null]);
    for (const a of rencana) {
      const real = pk.alokasi.find((x) => x.status === "REALISASI" && x.tahun === a.tahun);
      const ind = pk.indikatorRo?.[0];
      const dana = SD.map((k) => Number(a[k]) || 0);
      const nilai = [...dana, Number(a.total), real ? Number(real.total) : null];
      nilai.forEach((v, i) => (total[i] += v ?? 0));
      out.push([
        pk.name,
        pk.satker?.name ?? "–",
        pk.ro ? `${pk.ro.kro.code}.${pk.ro.code} ${pk.ro.name}` : "–",
        ind ? `${ind.indikatorRo?.nama ?? "–"} (${ind.satuan ?? "–"})` : "–",
        (pk.lokasiRo ?? []).map((id) => namaProvinsi[id] ?? id).join(", ") || "–",
        a.tahun,
        a.komponen ? `${a.komponen.code} ${a.komponen.name} (${a.komponen.jenis === "PENDUKUNG" ? "pendukung" : "utama"})` : "–",
        a.outputTarget != null ? `${Number(a.outputTarget).toLocaleString("id-ID")} ${pk.ro?.satuan?.name ?? ""}`.trim() : "–",
        a.outcomeTarget != null ? `${Number(a.outcomeTarget).toLocaleString("id-ID")} ${ind?.satuan ?? ""}`.trim() : "–",
        ...nilai.map((v, i) => (v == null || (v === 0 && i < 5) ? null : v)),
      ]);
    }
  }
  if (out.length) out.push(["Total", "", "", "", "", "", "", "", "", ...total.map((v) => v || null)]);
  return out;
}

const namaFile = (p: Proyek) =>
  `proyek-${(p.kodeProyek ?? p.projectName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${new Date().toISOString().slice(0, 10)}`;

export function unduhDetailExcel(p: Proyek, isi: IsiBaris[], namaProvinsi: Record<string, string>, pencetak: string) {
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet([["Kolom", "Isi"], ...ringkasan(p, pencetak)]);
  ws1["!cols"] = [{ wch: 18 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan");

  const ws2 = XLSX.utils.aoa_to_sheet([["Tab", "Kolom", "Isi", "Jenis"], ...isi.map((b) => [b.tab, b.kolom, b.isi, b.jenis])]);
  ws2["!cols"] = [{ wch: 22 }, { wch: 40 }, { wch: 70 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Isi usulan");

  const paket = barisPaket(p, namaProvinsi);
  const ws3 = XLSX.utils.aoa_to_sheet([
    KEPALA_PAKET.map((k, i) => (i >= KOLOM_ANGKA ? `${k} (Rp)` : k)),
    ...paket.map((r) => r.map((v) => v ?? "–")),
  ]);
  ws3["!cols"] = KEPALA_PAKET.map((_, i) => ({ wch: i < 5 ? 26 : i < KOLOM_ANGKA ? 14 : 16 }));
  // Rupiah sebagai angka berformat ribuan (bisa dijumlah di Excel).
  for (let r = 1; r <= paket.length; r++)
    for (let c = KOLOM_ANGKA; c < KEPALA_PAKET.length; c++) {
      const sel = ws3[XLSX.utils.encode_cell({ r, c })];
      if (sel && typeof sel.v === "number") sel.z = "#,##0";
    }
  XLSX.utils.book_append_sheet(wb, ws3, "Paket");

  XLSX.writeFile(wb, `${namaFile(p)}.xlsx`);
}

const ORANYE: [number, number, number] = [178, 75, 10];

export function unduhDetailPdf(p: Proyek, isi: IsiBaris[], namaProvinsi: Record<string, string>, pencetak: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Detail proyek", 14, 14);
  doc.setFontSize(14);
  doc.setTextColor(20);
  const judul = doc.splitTextToSize(p.projectName, 180);
  doc.text(judul, 14, 21);
  let y = 21 + judul.length * 6;

  autoTable(doc, {
    startY: y,
    body: ringkasan(p, pencetak),
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 1.2 },
    columnStyles: { 0: { cellWidth: 38, textColor: 110 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Satu tabel per tab, urutan sama dengan layar.
  const tabs = [...new Set(isi.map((b) => b.tab))];
  for (const tab of tabs) {
    autoTable(doc, {
      startY: y,
      head: [[tab, ""]],
      body: isi.filter((b) => b.tab === tab).map((b) => [b.kolom + (b.jenis === "tambahan" ? " (tambahan)" : ""), b.isi]),
      styles: { fontSize: 8, cellPadding: 1.6, overflow: "linebreak" },
      headStyles: { fillColor: ORANYE, textColor: 255 },
      columnStyles: { 0: { cellWidth: 62, textColor: 90 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  // Paket: halaman mendatar, angka penuh.
  const paket = barisPaket(p, namaProvinsi);
  doc.addPage("a4", "landscape");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(`Paket · ${p.projectName}`, 14, 14);
  autoTable(doc, {
    startY: 19,
    head: [KEPALA_PAKET],
    body: paket.length
      ? paket.map((r) => r.map((v, i) => (v == null ? "–" : i >= KOLOM_ANGKA && typeof v === "number" ? v.toLocaleString("id-ID") : String(v))))
      : [["Belum ada paket", ...Array(KEPALA_PAKET.length - 1).fill("")]],
    styles: { fontSize: 6.5, cellPadding: 1.2, overflow: "linebreak" },
    headStyles: { fillColor: ORANYE, textColor: 255 },
    columnStyles: Object.fromEntries(
      KEPALA_PAKET.map((_, i) => [i, i >= KOLOM_ANGKA - 2 ? { halign: "right" as const } : { cellWidth: i < 5 ? 26 : "auto" as const }]),
    ),
    didParseCell: (h) => {
      if (h.section === "body" && paket.length && h.row.index === paket.length - 1) h.cell.styles.fontStyle = "bold";
    },
  });

  doc.save(`${namaFile(p)}.pdf`);
}
