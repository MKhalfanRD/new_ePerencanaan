import * as XLSX from "xlsx";

/**
 * Export master nomenklatur ke satu sheet "Nomenklatur" berbentuk outline
 * hierarkis: Program > Kegiatan > KRO > RO > (Indikator RO / Komponen).
 * Kolom induk hanya diisi di baris pertama kemunculannya (sel di bawahnya
 * dikosongkan), meniru format sheet "RSPP" di referensi 1.xlsx — jadi
 * struktur 1-ke-banyak (1 program → banyak kegiatan, dst) tetap kebaca.
 * Periode/Tahun bukan bagian hierarki, jadi tetap di sheet terpisah.
 */
export interface MasterNomenklatur {
  programs: any[];
  kegiatan: any[];
  kro: any[];
  ro: any[];
  indikatorRO: any[];
  komponen: any[];
  periodes: any[];
}

type Row = {
  "Kode Program": string;
  Program: string;
  "Kode Kegiatan": string;
  Kegiatan: string;
  "Kode KRO": string;
  KRO: string;
  "Kode RO": string;
  RO: string;
  "Satuan RO": string;
  "Kode Komponen": string;
  Komponen: string;
  "Indikator RO": string;
};

const KOSONG: Row = {
  "Kode Program": "",
  Program: "",
  "Kode Kegiatan": "",
  Kegiatan: "",
  "Kode KRO": "",
  KRO: "",
  "Kode RO": "",
  RO: "",
  "Satuan RO": "",
  "Kode Komponen": "",
  Komponen: "",
  "Indikator RO": "",
};

const groupBy = <T>(list: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of list) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
};

const byCode = (a: any, b: any) =>
  String(a.code ?? a.name ?? "").localeCompare(
    String(b.code ?? b.name ?? ""),
    "id",
    { numeric: true },
  );

export function exportMasterToExcel(
  data: MasterNomenklatur,
  filename = "master-data",
) {
  const kegByProgram = groupBy(data.kegiatan, (k) => k.programId);
  const kroByKegiatan = groupBy(data.kro, (k) => k.kegiatanId);
  const roByKro = groupBy(data.ro, (r) => r.kroId);
  const iroByRo = groupBy(data.indikatorRO, (i) => i.roId);
  const komponenByRo = groupBy(data.komponen, (k) => k.roId);

  const rows: Row[] = [];

  for (const prog of [...data.programs].sort(byCode)) {
    rows.push({
      ...KOSONG,
      "Kode Program": prog.code ?? prog.id,
      Program: prog.name,
    });

    for (const keg of (kegByProgram.get(prog.id) ?? []).sort(byCode)) {
      rows.push({
        ...KOSONG,
        "Kode Kegiatan": keg.code ?? keg.id,
        Kegiatan: keg.name,
      });

      for (const kro of (kroByKegiatan.get(keg.id) ?? []).sort(byCode)) {
        rows.push({
          ...KOSONG,
          "Kode KRO": kro.code ?? kro.id,
          KRO: kro.name,
        });

        for (const ro of (roByKro.get(kro.id) ?? []).sort(byCode)) {
          rows.push({
            ...KOSONG,
            "Kode RO": ro.code,
            RO: ro.name,
            "Satuan RO": ro.satuan ?? "",
            "Indikator RO": (iroByRo.get(ro.id) ?? [])
              .map((i) => `${i.nama} (${i.satuan})`)
              .join("; "),
          });

          for (const komp of (komponenByRo.get(ro.id) ?? []).sort(byCode)) {
            rows.push({
              ...KOSONG,
              "Kode Komponen": komp.code,
              Komponen: komp.name,
            });
          }
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows.length ? rows : [KOSONG]),
    "Nomenklatur",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.periodes.map((p) => ({
        ID: p.id,
        Label: p.label,
        "Tahun Mulai": p.startYear,
        "Tahun Akhir": p.endYear,
        Aktif: p.isActive ? "Ya" : "Tidak",
      })),
    ),
    "Tahun",
  );

  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
