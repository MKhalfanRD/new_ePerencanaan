/**
 * Import SEKALI JALAN data master indikator RENJA dari `referensi 1.xlsx`
 * (sheet PNPPKP, SPSK, Tagging RENJA) ke tabel master baru:
 *   - PrioritasNasional (PN) > ProgramPrioritas (PP) > KegiatanPrioritas (KP)
 *   - SasaranProgram (SP) > IndikatorSasaranProgram (ISP) — anak Program
 *   - SasaranKegiatan (SK) > IndikatorSasaranKegiatan (ISK) — anak Kegiatan
 *   - Pkpn, TematikRenja (daftar flat)
 *
 * Lihat docs-planning/fitur-paket/04-rekonsiliasi-referensi.md untuk struktur
 * lengkap sheet-sheet ini dan alasan field Paket diganti dari teks bebas jadi
 * FK ke tabel-tabel ini.
 *
 * Cara pakai:
 *   1. Pastikan skema sudah dimigrasikan: npx prisma migrate dev
 *   2. npx ts-node prisma/scripts/seed-indikator-renja.ts
 *   3. Idempotent — aman dijalankan ulang (upsert berdasarkan code/name unik,
 *      atau cek-lalu-buat untuk teks panjang yang tidak diberi unique index).
 *
 * Catatan: sheet SPSK menyebut Kegiatan (7686-7695, 7755) yang sebagian besar
 * BELUM ada di tabel `kegiatan` project ini (lihat gap di dokumen rekonsiliasi
 * §1a) — script ini upsert baris Kegiatan minimal (id/code/name/programId)
 * kalau belum ada, TANPA menyentuh KRO/RO (itu keputusan terpisah, lihat
 * dokumen rekonsiliasi §7 poin 1). Kegiatan 7755 ada di Program "WA" (Dukungan
 * Manajemen), sisanya di Program "FC" (Ketahanan Sumber Daya Air) — dipetakan
 * manual dari sheet RSPP baris 2 & 442.
 */
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const FILE_PATH = path.resolve(__dirname, '../../../../referensi 1.xlsx');

const PROGRAM_ID_BY_NAME: Record<string, string> = {
  'Ketahanan Sumber Daya Air': 'FC',
  'Dukungan Manajemen': 'WA',
};
const KEGIATAN_PROGRAM_ID = (kegiatanCode: string) =>
  kegiatanCode === '7755' ? 'WA' : 'FC';

/** "02.12 Swasembada Air" -> { code: "02.12", name: "Swasembada Air" } */
function splitCodeName(s: string): { code: string; name: string } {
  const trimmed = s.trim();
  const m = trimmed.match(/^(\S+)\s+(.*)$/s);
  if (!m) return { code: trimmed, name: trimmed };
  return { code: m[1], name: m[2].trim() };
}

async function ensurePrograms() {
  await prisma.program.upsert({
    where: { id: 'FC' },
    update: {},
    create: { id: 'FC', code: 'FC', name: 'FC Ketahanan Sumber Daya Air' },
  });
  await prisma.program.upsert({
    where: { id: 'WA' },
    update: {},
    create: { id: 'WA', code: 'WA', name: 'WA Dukungan Manajemen' },
  });
}

// =============================================
// PNPPKP — PN > PP > KP
// =============================================
async function seedPnPpKp(wb: XLSX.WorkBook) {
  const ws = wb.Sheets['PNPPKP'];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  });

  let currentPn: { code: string; name: string } | null = null;
  let currentPp: { code: string; name: string } | null = null;
  let countPn = 0,
    countPp = 0,
    countKp = 0;

  // rows[0] = ['RPJMN'], rows[1] = ['PN','PP','KP'] — data mulai rows[2]
  for (const row of rows.slice(2)) {
    const [pnCell, ppCell, kpCell, kpExtra] = row;

    if (pnCell) {
      currentPn = splitCodeName(String(pnCell));
      await prisma.prioritasNasional.upsert({
        where: { code: currentPn.code },
        update: { name: currentPn.name },
        create: { code: currentPn.code, name: currentPn.name },
      });
      countPn++;
    }

    if (ppCell) {
      currentPp = splitCodeName(String(ppCell));
      if (!currentPn) throw new Error(`PP "${ppCell}" tanpa PN induk`);
      const pn = await prisma.prioritasNasional.findUniqueOrThrow({
        where: { code: currentPn.code },
      });
      await prisma.programPrioritas.upsert({
        where: { code: currentPp.code },
        update: { name: currentPp.name, prioritasNasionalId: pn.id },
        create: {
          code: currentPp.code,
          name: currentPp.name,
          prioritasNasionalId: pn.id,
        },
      });
      countPp++;
    }

    if (kpCell) {
      // Anomali: satu baris (KP "02.12.09") kodenya sendirian di kolom KP,
      // namanya "lompat" ke kolom berikutnya alih-alih digabung satu sel.
      const isCodeOnly = /^[\d.]+$/.test(String(kpCell).trim());
      const { code, name } =
        isCodeOnly && kpExtra
          ? { code: String(kpCell).trim(), name: String(kpExtra).trim() }
          : splitCodeName(String(kpCell));

      if (!currentPp) throw new Error(`KP "${kpCell}" tanpa PP induk`);
      const pp = await prisma.programPrioritas.findUniqueOrThrow({
        where: { code: currentPp.code },
      });
      await prisma.kegiatanPrioritas.upsert({
        where: { code },
        update: { name, programPrioritasId: pp.id },
        create: { code, name, programPrioritasId: pp.id },
      });
      countKp++;
    }
  }

  console.log(`✅ PN: ${countPn}, PP: ${countPp}, KP: ${countKp}`);
}

// =============================================
// SPSK — SP/ISP (anak Program) & SK/ISK (anak Kegiatan)
// =============================================
async function seedSpSk(wb: XLSX.WorkBook) {
  const ws = wb.Sheets['SPSK'];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  });

  let section: 'program' | 'kegiatan' = 'program';
  let currentProgramName: string | null = null;
  let currentSasaranProgramId: string | null = null;
  let currentKegiatan: { code: string; name: string } | null = null;
  let currentSasaranKegiatanId: string | null = null;
  let countSp = 0,
    countIsp = 0,
    countSk = 0,
    countIsk = 0;

  // rows[0] = header 'Program|SP|ISP' — data mulai rows[1]
  for (const row of rows.slice(1)) {
    const [col0, col1, col2] = row;

    if (col0 === 'Kegiatan') {
      // Baris sub-header 'Kegiatan|SK|ISK' — pindah section, lewati baris ini
      section = 'kegiatan';
      continue;
    }

    if (section === 'program') {
      if (col0) {
        currentProgramName = String(col0).trim();
      }
      if (col1) {
        const programId = PROGRAM_ID_BY_NAME[currentProgramName ?? ''];
        if (!programId) {
          throw new Error(`Program "${currentProgramName}" tidak dikenal`);
        }
        const spName = String(col1).trim();
        let sp = await prisma.sasaranProgram.findFirst({
          where: { programId, name: spName },
        });
        if (!sp) {
          sp = await prisma.sasaranProgram.create({
            data: { programId, name: spName },
          });
          countSp++;
        }
        currentSasaranProgramId = sp.id;
      }
      if (col2) {
        if (!currentSasaranProgramId) {
          throw new Error(`ISP "${col2}" tanpa SP induk`);
        }
        const ispName = String(col2).trim();
        const existing = await prisma.indikatorSasaranProgram.findFirst({
          where: {
            sasaranProgramId: currentSasaranProgramId,
            name: ispName,
          },
        });
        if (!existing) {
          await prisma.indikatorSasaranProgram.create({
            data: { sasaranProgramId: currentSasaranProgramId, name: ispName },
          });
          countIsp++;
        }
      }
    } else {
      if (col0) {
        currentKegiatan = splitCodeName(String(col0));
        await prisma.kegiatan.upsert({
          where: { id: currentKegiatan.code },
          update: {},
          create: {
            id: currentKegiatan.code,
            programId: KEGIATAN_PROGRAM_ID(currentKegiatan.code),
            code: currentKegiatan.code,
            name: currentKegiatan.name,
          },
        });
      }
      if (col1) {
        if (!currentKegiatan) throw new Error(`SK "${col1}" tanpa Kegiatan induk`);
        const skName = String(col1).trim();
        let sk = await prisma.sasaranKegiatan.findFirst({
          where: { kegiatanId: currentKegiatan.code, name: skName },
        });
        if (!sk) {
          sk = await prisma.sasaranKegiatan.create({
            data: { kegiatanId: currentKegiatan.code, name: skName },
          });
          countSk++;
        }
        currentSasaranKegiatanId = sk.id;
      }
      if (col2) {
        if (!currentSasaranKegiatanId) {
          throw new Error(`ISK "${col2}" tanpa SK induk`);
        }
        const iskName = String(col2).trim();
        const existing = await prisma.indikatorSasaranKegiatan.findFirst({
          where: {
            sasaranKegiatanId: currentSasaranKegiatanId,
            name: iskName,
          },
        });
        if (!existing) {
          await prisma.indikatorSasaranKegiatan.create({
            data: {
              sasaranKegiatanId: currentSasaranKegiatanId,
              name: iskName,
            },
          });
          countIsk++;
        }
      }
    }
  }

  console.log(
    `✅ SP: ${countSp}, ISP: ${countIsp}, SK: ${countSk}, ISK: ${countIsk}`,
  );
}

// =============================================
// Tagging RENJA — Tematik & PKPN (daftar flat)
// =============================================
async function seedTaggingRenja(wb: XLSX.WorkBook) {
  const ws = wb.Sheets['Tagging RENJA'];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  });

  let countTematik = 0,
    countPkpn = 0;

  // rows[0] = ['TEMATIK','PKPN'] — data mulai rows[1]
  for (const row of rows.slice(1)) {
    const [tematik, pkpn] = row;
    if (tematik) {
      await prisma.tematikRenja.upsert({
        where: { name: String(tematik).trim() },
        update: {},
        create: { name: String(tematik).trim() },
      });
      countTematik++;
    }
    if (pkpn) {
      await prisma.pkpn.upsert({
        where: { name: String(pkpn).trim() },
        update: {},
        create: { name: String(pkpn).trim() },
      });
      countPkpn++;
    }
  }

  console.log(`✅ Tematik RENJA: ${countTematik}, PKPN: ${countPkpn}`);
}

async function main() {
  console.log(`Membaca ${FILE_PATH} ...`);
  const wb = XLSX.readFile(FILE_PATH);

  await ensurePrograms();
  await seedPnPpKp(wb);
  await seedSpSk(wb);
  await seedTaggingRenja(wb);

  console.log('✅ Selesai.');
}

main()
  .catch((err) => {
    console.error('❌ Gagal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
