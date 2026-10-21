import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Proyek } from "@/types";

const formatRupiah = (val: string | number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    Number(val),
  );

const statusLabel: Record<string, string> = {
  DRAFT: "Draft",
  DIAJUKAN: "Diajukan",
  DIPERIKSA: "Diperiksa",
  DIKEMBALIKAN: "Dikembalikan",
  APPROVED: "Disetujui",
};

// Semua Alokasi lintas Paket milik satu Proyek, dengan info paket (RO,
// jenis, masa pelaksanaan) ikut disalin ke tiap baris supaya sheet/tabel
// export tidak perlu join manual.
const flatAlokasi = (p: Proyek) =>
  p.paket.flatMap((pk) =>
    pk.alokasi.map((a) => ({ ...a, paket: pk, ro: pk.ro })),
  );

// ============================================================
// EXPORT EXCEL — LIST (multiple proyek, ringkas)
// ============================================================
export function exportProyekToExcel(
  proyekList: Proyek[],
  filename = "daftar-proyek",
) {
  const rows = proyekList.map((p) => {
    const alokasi = flatAlokasi(p);
    const totalRencana = alokasi
      .filter((a) => a.status === "RENCANA")
      .reduce((s, a) => s + Number(a.total), 0);
    const totalRealisasi = alokasi
      .filter((a) => a.status === "REALISASI")
      .reduce((s, a) => s + Number(a.total), 0);

    return {
      "Nama Proyek": p.projectName,
      Balai: p.balai.name,
      Periode: p.periode.label,
      Status: statusLabel[p.status],
      "Jumlah Paket": p.paket.length,
      Kewenangan: p.kewenangan,
      "Total Rencana (Rp)": totalRencana,
      "Total Realisasi (Rp)": totalRealisasi,
      "Dibuat Oleh": p.createdBy.name,
      "Tanggal Dibuat": new Date(p.createdAt).toLocaleDateString("id-ID"),
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 40 },
    { wch: 30 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Daftar Proyek");
  XLSX.writeFile(wb, `${filename}-${Date.now()}.xlsx`);
}

// ============================================================
// EXPORT PDF — LIST (multiple proyek, ringkas)
// ============================================================
export function exportProyekToPDF(
  proyekList: Proyek[],
  filename = "daftar-proyek",
) {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text("Daftar Proyek - ePerencanaan", 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `Dicetak: ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}`,
    14,
    21,
  );

  const rows = proyekList.map((p) => {
    const totalRencana = flatAlokasi(p)
      .filter((a) => a.status === "RENCANA")
      .reduce((s, a) => s + Number(a.total), 0);

    return [
      p.projectName,
      p.balai.shortName || p.balai.name,
      p.periode.label,
      statusLabel[p.status],
      formatRupiah(totalRencana),
      p.createdBy.name,
    ];
  });

  autoTable(doc, {
    startY: 26,
    head: [
      [
        "Nama Proyek",
        "Balai",
        "Periode",
        "Status",
        "Total Rencana (Rp)",
        "Dibuat Oleh",
      ],
    ],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 0: { cellWidth: 80 } },
  });

  doc.save(`${filename}-${Date.now()}.pdf`);
}
