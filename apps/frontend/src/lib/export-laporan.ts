import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Unduh laporan (flowchart-laporan.pdf): angka PENUH di Excel & PDF
 * (keputusan 20 Okt). Data sama persis dengan pratinjau di layar.
 */
export interface KolomLaporan {
  key: string;
  label: string;
  jenis: "rp" | "n" | "pct";
}
export interface BarisLaporan {
  label: string;
  rincian?: boolean;
  nilai: Record<string, number | null>;
}
export interface DataLaporan {
  judul: string;
  kolom: KolomLaporan[];
  baris: BarisLaporan[];
  total: BarisLaporan[];
}

export const angkaPenuh = (v: number | null | undefined, jenis: KolomLaporan["jenis"]) => {
  if (v == null) return "–";
  if (jenis === "pct") return `${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
  if (jenis === "rp") return `Rp ${Math.round(v).toLocaleString("id-ID")}`;
  return v.toLocaleString("id-ID");
};

const namaFile = (judul: string) =>
  `laporan-${judul.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${new Date().toISOString().slice(0, 10)}`;

export function unduhExcel(data: DataLaporan, saringan: [string, string][], pencetak: string) {
  const kepala = ["Uraian", ...data.kolom.map((k) => (k.jenis === "rp" ? `${k.label} (Rp)` : k.label))];
  const baris = [...data.baris, ...data.total].map((b) => [
    b.rincian ? `   ${b.label}` : b.label,
    // Sel angka (bukan teks) supaya bisa dijumlah di Excel; persen 1 desimal.
    ...data.kolom.map((k) => {
      const v = b.nilai[k.key];
      return v == null ? null : k.jenis === "pct" ? Math.round(v * 10) / 10 : v;
    }),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([kepala, ...baris]);
  ws["!cols"] = [{ wch: 60 }, ...data.kolom.map(() => ({ wch: 20 }))];
  // Format ribuan untuk kolom rupiah & bilangan.
  for (let r = 1; r <= baris.length; r++)
    data.kolom.forEach((k, i) => {
      const sel = ws[XLSX.utils.encode_cell({ r, c: i + 1 })];
      if (sel && typeof sel.v === "number") sel.z = k.jenis === "pct" ? "0.0" : "#,##0";
    });
  const keterangan = XLSX.utils.aoa_to_sheet([
    ["Laporan", data.judul],
    ...saringan,
    ["Dicetak", new Date().toLocaleString("id-ID")],
    ["Dicetak oleh", pencetak],
  ]);
  keterangan["!cols"] = [{ wch: 18 }, { wch: 60 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laporan");
  XLSX.utils.book_append_sheet(wb, keterangan, "Saringan");
  XLSX.writeFile(wb, `${namaFile(data.judul)}.xlsx`);
}

export function unduhPdf(data: DataLaporan, saringan: [string, string][], pencetak: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text(data.judul, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(saringan.map(([k, v]) => `${k}: ${v}`).join("   ·   "), 14, 22);
  doc.text(`Dicetak ${new Date().toLocaleString("id-ID")} oleh ${pencetak}`, 14, 27);
  autoTable(doc, {
    startY: 32,
    head: [["Uraian", ...data.kolom.map((k) => k.label)]],
    body: [...data.baris, ...data.total].map((b) => [
      b.rincian ? `   ${b.label}` : b.label,
      ...data.kolom.map((k) => angkaPenuh(b.nilai[k.key], k.jenis)),
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [178, 75, 10], textColor: 255 },
    columnStyles: Object.fromEntries(data.kolom.map((_, i) => [i + 1, { halign: "right" as const }])),
    didParseCell: (h) => {
      if (h.section !== "body") return;
      const semua = [...data.baris, ...data.total];
      const b = semua[h.row.index];
      if (h.row.index >= data.baris.length) h.cell.styles.fontStyle = "bold";
      else if (!b?.rincian) h.cell.styles.fillColor = [246, 243, 240];
    },
  });
  doc.save(`${namaFile(data.judul)}.pdf`);
}
