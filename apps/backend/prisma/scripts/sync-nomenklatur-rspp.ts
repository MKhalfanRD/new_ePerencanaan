/**
 * Sinkronkan nama Program/Kegiatan/KRO/RO di DB dengan sheet "RSPP" pada
 * `referensi 1.xlsx` — satu-satunya sumber kebenaran untuk nomenklatur,
 * lebih lengkap & lebih akurat dari `kro-ro-master.json` (yang cuma cakup
 * KRO/RO SBSN 7691-7694 dan sempat salah ketik nama Kegiatan 7691).
 *
 * Aman dijalankan berkali-kali (upsert by id) dan tidak menghapus data
 * project (Planning/Paket/Alokasi) — id Kegiatan/KRO/RO tidak berubah,
 * cuma `name`/`code` yang disinkronkan ulang ke nilai resmi di Excel.
 *
 * Jalankan dengan:
 *   npx ts-node prisma/scripts/sync-nomenklatur-rspp.ts
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

interface ParsedRow {
  program?: { code: string; name: string };
  kegiatan?: { id: string; code: string; name: string };
  kro?: { id: string; kegiatanId: string; code: string; name: string };
  ro?: {
    id: string;
    kroId: string;
    code: string;
    name: string;
    satuan?: string;
  };
}

// "7691.CBG Prasarana Bidang SDA dan Irigasi" -> { code: "7691.CBG", name: "Prasarana..." }
// Sebagian sel di Excel memisahkan kode & nama dengan non-breaking space
// (U+00A0), bukan spasi biasa — pakai regex \s (cocok semua whitespace),
// bukan indexOf(' ') literal, supaya code tidak ikut menelan kata pertama.
function splitCodeName(cell: string): { code: string; name: string } {
  const trimmed = cell.trim();
  const spaceIdx = trimmed.search(/\s/);
  if (spaceIdx === -1) return { code: trimmed, name: trimmed };
  return {
    code: trimmed.slice(0, spaceIdx),
    name: trimmed.slice(spaceIdx + 1).trim(),
  };
}

function parseRow(row: any[]): ParsedRow {
  const [programCell, kegiatanCell, kroCell, roCell, satuanCell] = row;
  const result: ParsedRow = {};

  if (programCell) {
    const { code, name } = splitCodeName(String(programCell));
    result.program = { code, name };
  }
  if (kegiatanCell) {
    const { code, name } = splitCodeName(String(kegiatanCell));
    result.kegiatan = { id: code, code, name };
  }
  if (kroCell) {
    // format: "<kegiatanId>.<kroCode> <nama>"
    const { code: fullCode, name } = splitCodeName(String(kroCell));
    const dotIdx = fullCode.indexOf('.');
    const kegiatanId = fullCode.slice(0, dotIdx);
    const kroCode = fullCode.slice(dotIdx + 1);
    result.kro = { id: fullCode, kegiatanId, code: kroCode, name };
  }
  if (roCell) {
    // format: "<kegiatanId>.<kroCode>.<roCode> <nama>"
    const { code: fullCode, name } = splitCodeName(String(roCell));
    const parts = fullCode.split('.');
    const roCode = parts.slice(2).join('.');
    const kroId = `${parts[0]}.${parts[1]}`;
    result.ro = {
      id: fullCode,
      kroId,
      code: roCode,
      name,
      satuan: satuanCell ? String(satuanCell).trim() : undefined,
    };
  }
  return result;
}

async function main() {
  const wb = XLSX.readFile(
    path.resolve(__dirname, '../../../../referensi 1.xlsx'),
  );
  const sheet = wb.Sheets['RSPP'];
  if (!sheet) throw new Error('Sheet "RSPP" tidak ditemukan di referensi 1.xlsx');
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
  });

  let currentProgramCode = '';
  let programCount = 0;
  let kegiatanCount = 0;
  let kroCount = 0;
  let roCount = 0;

  // Baris 0 adalah header ("Program","Kegiatan","KRO","RO", ...).
  for (let i = 1; i < rows.length; i++) {
    const parsed = parseRow(rows[i]);

    if (parsed.program) {
      currentProgramCode = parsed.program.code;
      await prisma.program.upsert({
        where: { id: currentProgramCode },
        update: { code: currentProgramCode, name: parsed.program.name },
        create: {
          id: currentProgramCode,
          code: currentProgramCode,
          name: parsed.program.name,
        },
      });
      programCount++;
    }

    if (parsed.kegiatan) {
      await prisma.kegiatan.upsert({
        where: { id: parsed.kegiatan.id },
        update: { code: parsed.kegiatan.code, name: parsed.kegiatan.name },
        create: {
          id: parsed.kegiatan.id,
          programId: currentProgramCode,
          code: parsed.kegiatan.code,
          name: parsed.kegiatan.name,
        },
      });
      kegiatanCount++;
    }

    if (parsed.kro) {
      await prisma.kRO.upsert({
        where: { id: parsed.kro.id },
        update: { code: parsed.kro.code, name: parsed.kro.name },
        create: {
          id: parsed.kro.id,
          kegiatanId: parsed.kro.kegiatanId,
          code: parsed.kro.code,
          name: parsed.kro.name,
        },
      });
      kroCount++;
    }

    if (parsed.ro) {
      await prisma.rO.upsert({
        where: { id: parsed.ro.id },
        update: {
          code: parsed.ro.code,
          name: parsed.ro.name,
          satuan: parsed.ro.satuan || null,
        },
        create: {
          id: parsed.ro.id,
          kroId: parsed.ro.kroId,
          code: parsed.ro.code,
          name: parsed.ro.name,
          satuan: parsed.ro.satuan || null,
        },
      });
      roCount++;
    }
  }

  console.log(
    `✅ Sinkron dari referensi 1.xlsx (sheet RSPP): ${programCount} program, ${kegiatanCount} kegiatan, ${kroCount} KRO, ${roCount} RO.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
