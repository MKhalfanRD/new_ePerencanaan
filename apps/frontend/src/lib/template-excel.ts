import * as XLSX from "xlsx";

export interface KolomTemplate {
  label: string;
  wajib?: boolean;
  contoh?: string | number;
  keterangan?: string;
}

export interface TemplateExcel {
  /** Nama file tanpa ekstensi, mis. "template-balai". */
  nama: string;
  /** Judul pilihan di dialog (kalau ada >1 template). */
  judul?: string;
  kolom: KolomTemplate[];
  /** Nama sheet data (default "Data"); importer membaca sheet pertama. */
  sheet?: string;
}

/**
 * Unduh template import: sheet pertama = judul kolom kosong (yang dibaca
 * saat import), sheet "Petunjuk" = penjelasan & contoh tiap kolom. Kolom
 * pertama Petunjuk = nomor urut, supaya nama kolom (mis. "KodeProyek"/"TA")
 * tidak pernah muncul di sel pertama dan dikira header data oleh importer.
 */
export function unduhTemplate({ nama, kolom, sheet = "Data" }: TemplateExcel) {
  const wb = XLSX.utils.book_new();
  const data = XLSX.utils.aoa_to_sheet([kolom.map((k) => k.label)]);
  data["!cols"] = kolom.map((k) => ({ wch: Math.max(12, k.label.length + 2) }));
  XLSX.utils.book_append_sheet(wb, data, sheet.slice(0, 31));
  const petunjuk = XLSX.utils.aoa_to_sheet([
    ["No", "Kolom", "Wajib", "Contoh isian", "Keterangan"],
    ...kolom.map((k, i) => [
      i + 1,
      k.label,
      k.wajib ? "Wajib" : "Opsional",
      k.contoh ?? "",
      k.keterangan ?? "",
    ]),
  ]);
  petunjuk["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 10 }, { wch: 30 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, petunjuk, "Petunjuk");
  XLSX.writeFile(wb, `${nama}.xlsx`);
}
