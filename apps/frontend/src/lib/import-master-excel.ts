import * as XLSX from "xlsx";

/**
 * Baca balik file Excel yang dihasilkan `exportMasterToExcel()` (sheet
 * "Nomenklatur", outline Program > Kegiatan > KRO > RO > Komponen — kolom
 * induk cuma terisi di baris pertama kemunculannya). Hierarki direkonstruksi
 * dari urutan baris (parent = level yang terakhir terlihat), bukan dari kode
 * gabungan di dalam sel — sama seperti sheet aslinya.
 *
 * Skema id KRO/RO meniru convention manual di form Nomenklatur & script
 * sync-nomenklatur-rspp.ts: KRO.id = "<kegiatanId>.<kroCode>",
 * RO.id = "<kroId>.<roCode>".
 */
export interface ParsedNomenklatur {
  programs: { id: string; code: string; name: string }[];
  kegiatan: { id: string; programId: string; code: string; name: string }[];
  kro: { id: string; kegiatanId: string; code: string; name: string }[];
  ro: {
    id: string;
    kroId: string;
    code: string;
    name: string;
    satuan?: string;
  }[];
  komponen: { roId: string; code: string; name: string }[];
}

const teks = (v: any) => String(v ?? "").trim();

export function parseNomenklaturSheet(buf: ArrayBuffer): ParsedNomenklatur {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets["Nomenklatur"] ?? wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('Sheet "Nomenklatur" tidak ditemukan di file ini');
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, {
    defval: "",
  });

  const programs: ParsedNomenklatur["programs"] = [];
  const kegiatan: ParsedNomenklatur["kegiatan"] = [];
  const kro: ParsedNomenklatur["kro"] = [];
  const ro: ParsedNomenklatur["ro"] = [];
  const komponen: ParsedNomenklatur["komponen"] = [];

  const seenProgram = new Set<string>();
  const seenKegiatan = new Set<string>();
  const seenKro = new Set<string>();
  const seenRo = new Set<string>();

  let currentProgramId = "";
  let currentKegiatanId = "";
  let currentKroId = "";
  let currentRoId = "";

  rows.forEach((r, i) => {
    const kodeProgram = teks(r["Kode Program"]);
    const kodeKegiatan = teks(r["Kode Kegiatan"]);
    const kodeKro = teks(r["Kode KRO"]);
    const kodeRo = teks(r["Kode RO"]);
    const kodeKomponen = teks(r["Kode Komponen"]);

    if (kodeProgram) {
      currentProgramId = kodeProgram;
      if (!seenProgram.has(kodeProgram)) {
        seenProgram.add(kodeProgram);
        programs.push({
          id: kodeProgram,
          code: kodeProgram,
          name: teks(r["Program"]),
        });
      }
    }

    if (kodeKegiatan) {
      currentKegiatanId = kodeKegiatan;
      if (!seenKegiatan.has(kodeKegiatan)) {
        seenKegiatan.add(kodeKegiatan);
        if (!currentProgramId)
          throw new Error(
            `Baris ${i + 2}: Kegiatan "${kodeKegiatan}" tanpa Program induk (Program harus muncul di baris sebelumnya)`,
          );
        kegiatan.push({
          id: kodeKegiatan,
          programId: currentProgramId,
          code: kodeKegiatan,
          name: teks(r["Kegiatan"]),
        });
      }
    }

    if (kodeKro) {
      if (!currentKegiatanId)
        throw new Error(
          `Baris ${i + 2}: KRO "${kodeKro}" tanpa Kegiatan induk`,
        );
      currentKroId = `${currentKegiatanId}.${kodeKro}`;
      if (!seenKro.has(currentKroId)) {
        seenKro.add(currentKroId);
        kro.push({
          id: currentKroId,
          kegiatanId: currentKegiatanId,
          code: kodeKro,
          name: teks(r["KRO"]),
        });
      }
    }

    if (kodeRo) {
      if (!currentKroId)
        throw new Error(`Baris ${i + 2}: RO "${kodeRo}" tanpa KRO induk`);
      currentRoId = `${currentKroId}.${kodeRo}`;
      if (!seenRo.has(currentRoId)) {
        seenRo.add(currentRoId);
        ro.push({
          id: currentRoId,
          kroId: currentKroId,
          code: kodeRo,
          name: teks(r["RO"]),
          satuan: teks(r["Satuan RO"]) || undefined,
        });
      }
    }

    if (kodeKomponen) {
      if (!currentRoId)
        throw new Error(
          `Baris ${i + 2}: Komponen "${kodeKomponen}" tanpa RO induk`,
        );
      komponen.push({
        roId: currentRoId,
        code: kodeKomponen,
        name: teks(r["Komponen"]),
      });
    }
  });

  return { programs, kegiatan, kro, ro, komponen };
}
