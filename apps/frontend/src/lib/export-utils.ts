import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Planning } from "@/types";

const formatRupiah = (val: string | number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    Number(val),
  );

const statusLabel: Record<string, string> = {
  DRAFT: "Draft",
  APPROVED: "Disetujui",
};

// Semua Alokasi lintas Paket milik satu Planning, dengan info paket (RO,
// jenis, masa pelaksanaan) ikut disalin ke tiap baris supaya sheet/tabel
// export tidak perlu join manual.
const flatAlokasi = (p: Planning) =>
  p.paket.flatMap((pk) =>
    pk.alokasi.map((a) => ({ ...a, paket: pk, ro: pk.ro })),
  );

// ============================================================
// EXPORT EXCEL — LIST (multiple planning, ringkas)
// ============================================================
export function exportPlanningsToExcel(
  plannings: Planning[],
  filename = "daftar-planning",
) {
  const rows = plannings.map((p) => {
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
  XLSX.utils.book_append_sheet(wb, ws, "Daftar Planning");
  XLSX.writeFile(wb, `${filename}-${Date.now()}.xlsx`);
}

// ============================================================
// EXPORT EXCEL — DETAIL (single planning, lengkap multi-sheet)
// ============================================================
export function exportPlanningDetailToExcel(p: Planning) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Info Umum
  const infoRows = [
    { Field: "Nama Proyek", Value: p.projectName },
    { Field: "Balai", Value: p.balai.name },
    { Field: "Periode", Value: p.periode.label },
    { Field: "Status", Value: statusLabel[p.status] },
    { Field: "Jumlah Paket", Value: p.paket.length },
    { Field: "Kewenangan", Value: p.kewenangan },
    {
      Field: "Sumber Usulan Proyek",
      Value: p.sumberUsulanProyek
        ? p.sumberUsulanProyek === "LAINNYA"
          ? p.sumberUsulanLainnya || "Lainnya"
          : p.sumberUsulanProyek.replaceAll("_", " ")
        : "-",
    },
    { Field: "Kebutuhan Tanah", Value: p.kebutuhanTanah ? "Ada" : "Tidak" },
    { Field: "Sesuai RTRW", Value: p.sesuaiRTRW || "-" },
    { Field: "No. Perda RTRW", Value: p.nomorPerdaRTRW || "-" },
    { Field: "Sesuai Pola SDA", Value: p.sesuaiPolaSDA || "-" },
    { Field: "No. Kepmen PUPR", Value: p.nomorKepmenPUPR || "-" },
    { Field: "Sesuai Masterplan", Value: p.sesuaiMasterplan || "-" },
    { Field: "Dibuat Oleh", Value: p.createdBy.name },
    {
      Field: "Tanggal Dibuat",
      Value: new Date(p.createdAt).toLocaleDateString("id-ID"),
    },
  ];
  const wsInfo = XLSX.utils.json_to_sheet(infoRows);
  wsInfo["!cols"] = [{ wch: 22 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Info Umum");

  // Sheet 2: Tahapan Dokumen
  const dokumenRows = [
    { Tahapan: "Studi Kelayakan", Tahun: p.tahunStudiLayak || "-" },
    { Tahapan: "DED", Tahun: p.tahunDed || "-" },
    { Tahapan: "LARAP", Tahun: p.tahunLarap || "-" },
  ];
  const wsDokumen = XLSX.utils.json_to_sheet(dokumenRows);
  wsDokumen["!cols"] = [{ wch: 20 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsDokumen, "Tahapan Dokumen");

  // Sheet 3: Alokasi (lintas semua Paket)
  const alokasiAll = flatAlokasi(p);
  if (alokasiAll.length > 0) {
    const alokasiRows = alokasiAll
      .sort((a, b) => a.tahun - b.tahun)
      .map((a) => ({
        Paket: a.paket.name,
        Tahun: a.tahun,
        Status: a.status === "RENCANA" ? "Rencana" : "Realisasi",
        Program: a.ro.kro.kegiatan.program.code,
        Kegiatan: a.ro.kro.kegiatan.code,
        KRO: a.ro.kro.code,
        RO: a.ro.code,
        "RM (Rp)": Number(a.rm),
        "RMP (Rp)": Number(a.rmp),
        "PLN (Rp)": Number(a.pln),
        "SBSN (Rp)": Number(a.sbsn),
        "KPBU (Rp)": Number(a.kpbu),
        "Total (Rp)": Number(a.total),
        "Output Target": a.outputTarget || "-",
        "Output Unit": a.outputUnit || "-",
        "Outcome Target": a.outcomeTarget || "-",
        "Outcome Unit": a.outcomeUnit || "-",
        Catatan: a.catatan || "-",
      }));
    const wsAlokasi = XLSX.utils.json_to_sheet(alokasiRows);
    wsAlokasi["!cols"] = Array(18).fill({ wch: 14 });
    XLSX.utils.book_append_sheet(wb, wsAlokasi, "Alokasi Anggaran");
  }

  const safeName = p.projectName.substring(0, 30).replace(/[^a-z0-9]/gi, "-");
  XLSX.writeFile(wb, `planning-${safeName}-${Date.now()}.xlsx`);
}

// ============================================================
// EXPORT PDF — LIST (multiple planning, ringkas)
// ============================================================
export function exportPlanningsToPDF(
  plannings: Planning[],
  filename = "daftar-planning",
) {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text("Daftar Planning - ePerencanaan", 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `Dicetak: ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}`,
    14,
    21,
  );

  const rows = plannings.map((p) => {
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

// ============================================================
// EXPORT PDF — DETAIL (single planning, lengkap)
// ============================================================
export function exportPlanningDetailToPDF(p: Planning) {
  const doc = new jsPDF();
  let y = 15;

  doc.setFontSize(14);
  doc.text("Detail Planning", 14, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(p.projectName, 180);
  doc.text(titleLines, 14, y);
  y += titleLines.length * 6 + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `${p.balai.name} · ${p.periode.label} · Status: ${statusLabel[p.status]}`,
    14,
    y,
  );
  y += 8;

  // Info umum table
  doc.setTextColor(0);
  autoTable(doc, {
    startY: y,
    head: [["Informasi", "Nilai"]],
    body: [
      ["Jumlah Paket", String(p.paket.length)],
      ["Kewenangan", p.kewenangan],
      [
        "Sumber Usulan Proyek",
        p.sumberUsulanProyek
          ? p.sumberUsulanProyek === "LAINNYA"
            ? p.sumberUsulanLainnya || "Lainnya"
            : p.sumberUsulanProyek.replaceAll("_", " ")
          : "-",
      ],
      ["Kebutuhan Tanah", p.kebutuhanTanah ? "Ada" : "Tidak"],
      ["Sesuai RTRW", p.sesuaiRTRW || "-"],
      ["No. Perda RTRW", p.nomorPerdaRTRW || "-"],
      ["Sesuai Pola SDA", p.sesuaiPolaSDA || "-"],
      ["No. Kepmen PUPR", p.nomorKepmenPUPR || "-"],
      ["Dibuat Oleh", `${p.createdBy.name} (${p.createdBy.role.name})`],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 0: { cellWidth: 50, fontStyle: "bold" } },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Tahapan Dokumen
  {
    if (y > 250) {
      doc.addPage();
      y = 15;
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Tahapan Dokumen", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Tahapan", "Tahun"]],
      body: [
        ["Studi Kelayakan", p.tahunStudiLayak || "-"],
        ["DED", p.tahunDed || "-"],
        ["LARAP", p.tahunLarap || "-"],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Alokasi (lintas semua Paket)
  const alokasiAll = flatAlokasi(p);
  if (alokasiAll.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 15;
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Alokasi Anggaran", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [
        ["Paket", "Tahun", "Status", "Nomenklatur", "Total (Rp)", "Output"],
      ],
      body: alokasiAll
        .sort((a, b) => a.tahun - b.tahun)
        .map((a) => [
          a.paket.name,
          a.tahun,
          a.status === "RENCANA" ? "Rencana" : "Realisasi",
          `${a.ro.kro.kegiatan.program.code}.${a.ro.kro.code}.${a.ro.code}`,
          formatRupiah(a.total),
          a.outputTarget ? `${a.outputTarget} ${a.outputUnit || ""}` : "-",
        ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  const safeName = p.projectName.substring(0, 30).replace(/[^a-z0-9]/gi, "-");
  doc.save(`planning-${safeName}-${Date.now()}.pdf`);
}
