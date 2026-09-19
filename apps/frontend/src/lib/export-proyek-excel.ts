import ExcelJS from "exceljs";
import { Planning } from "@/types";

/**
 * Export semua Proyek/Paket ke satu file Excel, dikelompokkan jadi 1 sheet
 * per Program+Kegiatan. 1 baris = 1 Paket pada 1 tahun alokasi. Kolom
 * Balai/KRO/RO/Tahun diberi Excel Data Validation (dropdown) yang
 * membatasi ke daftar valid — bukan sekadar teks bebas — sesuai daftar
 * master yang benar-benar dipakai di data yang diexport.
 */

// Nama sheet Excel maks 31 char & tidak boleh karakter \/*?[]: — potong &
// bersihkan supaya tiap Program+Kegiatan tetap unik & valid.
function sheetName(programCode: string, kegiatanCode: string, used: Set<string>) {
  let base = `${programCode}.${kegiatanCode}`.replace(/[\\/*?[\]:]/g, "-");
  if (base.length > 31) base = base.slice(0, 31);
  let name = base;
  let i = 2;
  while (used.has(name)) {
    const suffix = `~${i}`;
    name = base.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  used.add(name);
  return name;
}

const paketOf = (p: Planning) => p.paket ?? [];

export async function exportPlanningsToExcel(plannings: Planning[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ePerencanaan";
  wb.created = new Date();

  // ---- Kumpulkan daftar master untuk dropdown (Balai/KRO/RO/Tahun) ----
  const balaiSet = new Map<number, string>();
  const kroSet = new Map<string, string>();
  const roSet = new Map<string, string>();
  const yearSet = new Set<number>();

  // ---- Kelompokkan baris (1 Paket x 1 Tahun) per Program+Kegiatan ----
  type Row = {
    balai: string;
    kodeProyek: string;
    namaProyek: string;
    kro: string;
    ro: string;
    namaPaket: string;
    tahun: number;
    rencana: number;
    realisasi: number;
  };
  const groupMap = new Map<
    string,
    { programCode: string; programName: string; kegiatanCode: string; kegiatanName: string; rows: Row[] }
  >();

  for (const p of plannings) {
    balaiSet.set(p.balai.id, p.balai.name);
    for (const pk of paketOf(p)) {
      const ro = pk.ro;
      if (!ro) continue;
      const kro = ro.kro;
      const keg = kro.kegiatan;
      const prog = keg.program;
      kroSet.set(kro.id, `${kro.code} — ${kro.name}`);
      roSet.set(ro.id, `${ro.code} — ${ro.name}`);

      const groupKey = `${prog.id}::${keg.id}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          programCode: prog.code,
          programName: prog.name,
          kegiatanCode: keg.code,
          kegiatanName: keg.name,
          rows: [],
        });
      }
      const group = groupMap.get(groupKey)!;

      // Rekap Rencana/Realisasi per tahun untuk paket ini.
      const byYear = new Map<number, { rencana: number; realisasi: number }>();
      for (const a of pk.alokasi) {
        yearSet.add(a.tahun);
        if (!byYear.has(a.tahun)) byYear.set(a.tahun, { rencana: 0, realisasi: 0 });
        const v = byYear.get(a.tahun)!;
        if (a.status === "RENCANA") v.rencana += Number(a.total);
        else v.realisasi += Number(a.total);
      }
      for (const [tahun, v] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
        group.rows.push({
          balai: p.balai.name,
          kodeProyek: p.kodeProyek || "",
          namaProyek: p.projectName,
          kro: `${kro.code} — ${kro.name}`,
          ro: `${ro.code} — ${ro.name}`,
          namaPaket: pk.name,
          tahun,
          rencana: v.rencana,
          realisasi: v.realisasi,
        });
      }
    }
  }

  // ---- Sheet tersembunyi berisi daftar valid untuk sumber dropdown ----
  const listSheet = wb.addWorksheet("_Lists", { state: "veryHidden" });
  const balaiList = [...balaiSet.values()].sort();
  const kroList = [...kroSet.values()].sort();
  const roList = [...roSet.values()].sort();
  const yearList = [...yearSet].sort((a, b) => a - b).map(String);

  balaiList.forEach((v, i) => (listSheet.getCell(i + 1, 1).value = v));
  kroList.forEach((v, i) => (listSheet.getCell(i + 1, 2).value = v));
  roList.forEach((v, i) => (listSheet.getCell(i + 1, 3).value = v));
  yearList.forEach((v, i) => (listSheet.getCell(i + 1, 4).value = Number(v)));

  const balaiRef = `_Lists!$A$1:$A$${Math.max(balaiList.length, 1)}`;
  const kroRef = `_Lists!$B$1:$B$${Math.max(kroList.length, 1)}`;
  const roRef = `_Lists!$C$1:$C$${Math.max(roList.length, 1)}`;
  const yearRef = `_Lists!$D$1:$D$${Math.max(yearList.length, 1)}`;

  const usedNames = new Set<string>();
  const sortedGroups = [...groupMap.values()].sort((a, b) =>
    `${a.programCode}${a.kegiatanCode}`.localeCompare(
      `${b.programCode}${b.kegiatanCode}`,
    ),
  );

  const headers = [
    "Balai",
    "Kode Proyek",
    "Nama Proyek",
    "KRO",
    "RO",
    "Nama Paket",
    "Tahun",
    "Rencana (Rp)",
    "Realisasi (Rp)",
  ];

  for (const group of sortedGroups) {
    const sheet = wb.addWorksheet(
      sheetName(group.programCode, group.kegiatanCode, usedNames),
    );

    sheet.addRow([`${group.programCode} — ${group.programName}`]);
    sheet.addRow([`${group.kegiatanCode} — ${group.kegiatanName}`]);
    sheet.addRow([]);
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };
    });

    const firstDataRow = 5;
    group.rows.forEach((r, idx) => {
      const excelRow = firstDataRow + idx;
      sheet.getRow(excelRow).values = [
        r.balai,
        r.kodeProyek,
        r.namaProyek,
        r.kro,
        r.ro,
        r.namaPaket,
        r.tahun,
        r.rencana,
        r.realisasi,
      ];
      sheet.getCell(excelRow, 8).numFmt = "#,##0";
      sheet.getCell(excelRow, 9).numFmt = "#,##0";

      // Dropdown asli Excel (Data Validation) — Balai/KRO/RO/Tahun dibatasi
      // ke daftar valid, bukan teks bebas.
      sheet.getCell(excelRow, 1).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [balaiRef],
      };
      sheet.getCell(excelRow, 4).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [kroRef],
      };
      sheet.getCell(excelRow, 5).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [roRef],
      };
      sheet.getCell(excelRow, 7).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [yearRef],
      };
    });

    sheet.columns = [
      { width: 32 }, // Balai
      { width: 14 }, // Kode Proyek
      { width: 34 }, // Nama Proyek
      { width: 34 }, // KRO
      { width: 42 }, // RO
      { width: 28 }, // Nama Paket
      { width: 8 }, // Tahun
      { width: 16 }, // Rencana
      { width: 16 }, // Realisasi
    ];
  }

  if (sortedGroups.length === 0) {
    wb.addWorksheet("Kosong").addRow(["Tidak ada data untuk diexport."]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `proyek-paket-${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
