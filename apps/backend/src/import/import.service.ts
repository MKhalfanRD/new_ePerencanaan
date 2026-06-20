import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { CommitImportDto } from './dto/import.dto';

const SHEETS_TO_PROCESS = ['7691', '7692', '7693', '7694'];
const DEFAULT_PROGRAM_ID = 'FC';
const DEFAULT_PROGRAM_NAME = 'FC Ketahanan Sumber Daya Air';

export interface ParsedRow {
  sheetName: string;
  excelRowNumber: number;
  ta: number;
  balaiName: string;
  kdgiat: string;
  kdKRO: string;
  kdRO: string;
  namaProyek: string;
  provinsi?: string;
  outputTarget?: number;
  outputUnit?: string;
  outcomeTarget?: number;
  outcomeUnit?: string;
  jumlah: number;
}

export interface ImportError {
  sheetName: string;
  excelRowNumber: number;
  namaProyek: string;
  balaiName: string;
  tahun: number;
  reason: string;
}

const importSessions = new Map<
  string,
  { rows: ParsedRow[]; createdAt: number }
>();

setInterval(
  () => {
    const now = Date.now();
    for (const [key, val] of importSessions.entries()) {
      if (now - val.createdAt > 30 * 60 * 1000) importSessions.delete(key);
    }
  },
  5 * 60 * 1000,
);

function normalizeBalaiName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/BALAI BESAR WILAYAH SUNGAI/g, 'BWS')
    .replace(/BALAI WILAYAH SUNGAI/g, 'WS')
    .replace(/[^A-Z0-9 ]/g, '');
}

function similarity(a: string, b: string): number {
  const s1 = normalizeBalaiName(a);
  const s2 = normalizeBalaiName(b);
  if (s1 === s2) return 1;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1;
  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

@Injectable()
export class ImportService {
  constructor(private prisma: PrismaService) {}

  async preview(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const allRows: ParsedRow[] = [];
    const parseErrors: ImportError[] = [];

    for (const sheetName of SHEETS_TO_PROCESS) {
      if (!workbook.SheetNames.includes(sheetName)) continue;
      const sheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      json.forEach((row, idx) => {
        const excelRowNumber = idx + 2;
        const ta = row['TA'];
        const balaiName = row['BALAI'];
        const namaProyek = row['Nama Proyek'];
        const kdRO = row['kdRO'] ?? row['KDRO'];
        const jumlah =
          row['   Jumlah   '] ?? row['  Jumlah  '] ?? row['Jumlah'];

        if (!ta) {
          parseErrors.push({
            sheetName,
            excelRowNumber,
            namaProyek: namaProyek || '(kosong)',
            balaiName: balaiName || '(kosong)',
            tahun: 0,
            reason: 'Kolom TA (tahun) kosong',
          });
          return;
        }
        if (!balaiName) {
          parseErrors.push({
            sheetName,
            excelRowNumber,
            namaProyek: namaProyek || '(kosong)',
            balaiName: '(kosong)',
            tahun: Number(ta),
            reason: 'Kolom BALAI kosong',
          });
          return;
        }
        if (!namaProyek) {
          parseErrors.push({
            sheetName,
            excelRowNumber,
            namaProyek: '(kosong)',
            balaiName,
            tahun: Number(ta),
            reason: 'Kolom Nama Proyek kosong',
          });
          return;
        }
        if (!kdRO) {
          parseErrors.push({
            sheetName,
            excelRowNumber,
            namaProyek,
            balaiName,
            tahun: Number(ta),
            reason: 'Kolom kdRO kosong',
          });
          return;
        }

        allRows.push({
          sheetName,
          excelRowNumber,
          ta: Number(ta),
          balaiName: String(balaiName).trim(),
          kdgiat: String(row['kdgiat'] ?? row['KDGIAT'] ?? sheetName).trim(),
          kdKRO: String(row['kdKRO'] ?? row['KDKRO'] ?? '').trim(),
          kdRO: String(kdRO).trim(),
          namaProyek: String(namaProyek).trim(),
          provinsi: row['Provinsi'] ?? row['LOKUS'] ?? undefined,
          outputTarget: row['V OUTPUT'] ?? row['V RO'] ?? undefined,
          outputUnit: row['Sat RO'] ?? undefined,
          outcomeTarget: row[' IRO '] ?? row['IRO'] ?? undefined,
          outcomeUnit: row['Sat IRO'] ?? undefined,
          jumlah: Number(jumlah) || 0,
        });
      });
    }

    if (allRows.length === 0) {
      throw new BadRequestException(
        'Tidak ada data valid ditemukan di file Excel.',
      );
    }

    // ===== Deteksi balai =====
    const uniqueBalaiNames = [...new Set(allRows.map((r) => r.balaiName))];
    const existingBalai = await this.prisma.balai.findMany();

    const matched: { excelName: string; balaiId: number; balaiName: string }[] =
      [];
    const unmatched: {
      excelName: string;
      suggestions: { id: number; name: string; score: number }[];
    }[] = [];
    const balaiNameToId = new Map<string, number>();

    for (const excelName of uniqueBalaiNames) {
      const exactMatch = existingBalai.find(
        (b) => normalizeBalaiName(b.name) === normalizeBalaiName(excelName),
      );
      if (exactMatch) {
        matched.push({
          excelName,
          balaiId: exactMatch.id,
          balaiName: exactMatch.name,
        });
        balaiNameToId.set(excelName, exactMatch.id);
        continue;
      }
      const suggestions = existingBalai
        .map((b) => ({
          id: b.id,
          name: b.name,
          score: similarity(excelName, b.name),
        }))
        .filter((s) => s.score > 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      unmatched.push({ excelName, suggestions });
    }

    // ===== Deteksi planning yang sudah ada (duplikat dari import sebelumnya) =====
    const groups = new Map<string, ParsedRow[]>();
    for (const row of allRows) {
      const key = `${row.balaiName}|${row.namaProyek}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const existingPlanningChecks: {
      groupKey: string;
      namaProyek: string;
      balaiName: string;
      existingId: string;
      existingAlokasiCount: number;
      existingTotal: number;
      newAlokasiCount: number;
      newTotal: number;
    }[] = [];

    for (const [groupKey, groupRows] of groups) {
      const balaiId = balaiNameToId.get(groupRows[0].balaiName);
      if (!balaiId) continue; // belum ter-resolve, cek nanti saat commit

      const existing = await this.prisma.planning.findFirst({
        where: { balaiId, projectName: groupRows[0].namaProyek },
        include: { alokasi: true },
      });

      if (existing) {
        existingPlanningChecks.push({
          groupKey,
          namaProyek: groupRows[0].namaProyek,
          balaiName: groupRows[0].balaiName,
          existingId: existing.id,
          existingAlokasiCount: existing.alokasi.length,
          existingTotal: existing.alokasi.reduce(
            (s, a) => s + Number(a.total),
            0,
          ),
          newAlokasiCount: groupRows.length,
          newTotal: groupRows.reduce((s, r) => s + r.jumlah, 0),
        });
      }
    }

    const planningGroups = groups.size;
    const sessionId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    importSessions.set(sessionId, { rows: allRows, createdAt: Date.now() });

    return {
      sessionId,
      summary: {
        totalRowsExcel: allRows.length + parseErrors.length,
        totalRowsValid: allRows.length,
        totalRowsError: parseErrors.length,
        totalPlanning: planningGroups,
        totalPlanningBaru: planningGroups - existingPlanningChecks.length,
        totalPlanningDuplikat: existingPlanningChecks.length,
        totalBalaiTerdeteksi: uniqueBalaiNames.length,
        totalBalaiMatched: matched.length,
        totalBalaiUnmatched: unmatched.length,
      },
      matched,
      unmatched,
      existingPlannings: existingPlanningChecks,
      parseErrors,
    };
  }

  async commit(dto: CommitImportDto, userId: string) {
    const session = importSessions.get(dto.sessionId);
    if (!session) {
      throw new NotFoundException(
        'Sesi import sudah tidak berlaku, silakan upload ulang file Excel',
      );
    }

    const { rows } = session;
    const currentYear = new Date().getFullYear();
    const commitErrors: ImportError[] = [];

    // Resolve balai
    const balaiMap = new Map<string, number>();
    for (const res of dto.balaiResolutions) {
      if (res.useExistingBalaiId) {
        balaiMap.set(res.excelName, res.useExistingBalaiId);
      } else if (res.createNew) {
        const maxBalai = await this.prisma.balai.findFirst({
          orderBy: { id: 'desc' },
        });
        const newId = (maxBalai?.id ?? 0) + 1;
        const newBalai = await this.prisma.balai.create({
          data: { id: newId, name: res.excelName },
        });
        balaiMap.set(res.excelName, newBalai.id);
      }
    }

    const existingBalai = await this.prisma.balai.findMany();
    const allExcelBalaiNames = [...new Set(rows.map((r) => r.balaiName))];
    for (const excelName of allExcelBalaiNames) {
      if (balaiMap.has(excelName)) continue;
      const exact = existingBalai.find(
        (b) => normalizeBalaiName(b.name) === normalizeBalaiName(excelName),
      );
      if (exact) balaiMap.set(excelName, exact.id);
    }

    const unresolvedBalai = allExcelBalaiNames.filter(
      (name) => !balaiMap.has(name),
    );
    if (unresolvedBalai.length > 0) {
      throw new BadRequestException(
        `Balai berikut belum diselesaikan: ${unresolvedBalai.join(', ')}`,
      );
    }

    // Map keputusan planning (skip/replace), default skip
    const planningDecisions = new Map<string, 'skip' | 'replace'>();
    for (const pr of dto.planningResolutions ?? []) {
      planningDecisions.set(pr.groupKey, pr.action);
    }

    // Program, Kegiatan, KRO, RO
    await this.prisma.program.upsert({
      where: { id: DEFAULT_PROGRAM_ID },
      update: {},
      create: {
        id: DEFAULT_PROGRAM_ID,
        code: DEFAULT_PROGRAM_ID,
        name: DEFAULT_PROGRAM_NAME,
      },
    });

    const kegiatanCache = new Map<string, boolean>();
    const kroCache = new Map<string, boolean>();
    const roCache = new Map<string, boolean>();

    for (const row of rows) {
      if (!kegiatanCache.has(row.kdgiat)) {
        await this.prisma.kegiatan.upsert({
          where: { id: row.kdgiat },
          update: {},
          create: {
            id: row.kdgiat,
            programId: DEFAULT_PROGRAM_ID,
            code: row.kdgiat,
            name: `Kegiatan ${row.kdgiat}`,
          },
        });
        kegiatanCache.set(row.kdgiat, true);
      }
      if (row.kdKRO && !kroCache.has(row.kdKRO)) {
        await this.prisma.kRO.upsert({
          where: { id: row.kdKRO },
          update: {},
          create: {
            id: row.kdKRO,
            kegiatanId: row.kdgiat,
            code: row.kdKRO,
            name: `KRO ${row.kdKRO}`,
          },
        });
        kroCache.set(row.kdKRO, true);
      }
      if (row.kdRO && row.kdKRO && !roCache.has(row.kdRO)) {
        await this.prisma.rO.upsert({
          where: { id: row.kdRO },
          update: {},
          create: {
            id: row.kdRO,
            kroId: row.kdKRO,
            code: row.kdRO,
            name: `RO ${row.kdRO}`,
          },
        });
        roCache.set(row.kdRO, true);
      }
    }

    // Periode
    const years = [...new Set(rows.map((r) => r.ta))];
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    let periode = await this.prisma.periode.findFirst({
      where: { startYear: { lte: minYear }, endYear: { gte: maxYear } },
    });
    if (!periode) {
      periode = await this.prisma.periode.create({
        data: {
          startYear: minYear,
          endYear: maxYear,
          label: `${minYear}-${maxYear}`,
          isActive: true,
        },
      });
    }

    // Group rows
    const groups = new Map<string, ParsedRow[]>();
    for (const row of rows) {
      const key = `${row.balaiName}|${row.namaProyek}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    let createdPlanning = 0;
    let updatedPlanning = 0;
    let skippedPlanning = 0;
    let createdAlokasi = 0;

    for (const [groupKey, groupRows] of groups) {
      const first = groupRows[0];
      const balaiId = balaiMap.get(first.balaiName)!;

      // Cek apakah planning ini sudah ada
      const existing = await this.prisma.planning.findFirst({
        where: { balaiId, projectName: first.namaProyek },
      });

      const decision = planningDecisions.get(groupKey) ?? 'skip';

      if (existing) {
        if (decision === 'skip') {
          skippedPlanning++;
          continue;
        }
        // decision === 'replace' -> hapus alokasi lama, buat alokasi baru
        try {
          await this.prisma.alokasi.deleteMany({
            where: { planningId: existing.id },
          });
          await this.prisma.planning.update({
            where: { id: existing.id },
            data: {
              masaPelaksanaan:
                groupRows.length > 1 ? 'MULTI_YEAR' : 'SINGLE_YEAR',
              provinceId: first.provinsi || undefined,
              alokasi: {
                create: groupRows.map((row) => ({
                  roId: row.kdRO,
                  tahun: row.ta,
                  status: row.ta <= currentYear ? 'REALISASI' : 'RENCANA',
                  rm: row.jumlah,
                  total: row.jumlah,
                  outputTarget: row.outputTarget,
                  outputUnit: row.outputUnit,
                  outcomeTarget: row.outcomeTarget,
                  outcomeUnit: row.outcomeUnit,
                  catatan: 'Hasil import dari Excel (replace)',
                })),
              },
            },
          });
          updatedPlanning++;
          createdAlokasi += groupRows.length;
        } catch (err: any) {
          for (const row of groupRows) {
            commitErrors.push({
              sheetName: row.sheetName,
              excelRowNumber: row.excelRowNumber,
              namaProyek: row.namaProyek,
              balaiName: row.balaiName,
              tahun: row.ta,
              reason: err.message?.substring(0, 150) || 'Gagal replace data',
            });
          }
        }
        continue;
      }

      // Planning baru
      try {
        await this.prisma.planning.create({
          data: {
            balaiId,
            periodeId: periode.id,
            projectName: first.namaProyek,
            masaPelaksanaan:
              groupRows.length > 1 ? 'MULTI_YEAR' : 'SINGLE_YEAR',
            kewenangan: 'PUSAT',
            provinceId: first.provinsi || undefined,
            status: 'DRAFT',
            createdById: userId,
            alokasi: {
              create: groupRows.map((row) => ({
                roId: row.kdRO,
                tahun: row.ta,
                status: row.ta <= currentYear ? 'REALISASI' : 'RENCANA',
                rm: row.jumlah,
                total: row.jumlah,
                outputTarget: row.outputTarget,
                outputUnit: row.outputUnit,
                outcomeTarget: row.outcomeTarget,
                outcomeUnit: row.outcomeUnit,
                catatan: 'Hasil import dari Excel',
              })),
            },
          },
        });
        createdPlanning++;
        createdAlokasi += groupRows.length;
      } catch (err: any) {
        for (const row of groupRows) {
          commitErrors.push({
            sheetName: row.sheetName,
            excelRowNumber: row.excelRowNumber,
            namaProyek: row.namaProyek,
            balaiName: row.balaiName,
            tahun: row.ta,
            reason:
              err.code === 'P2002'
                ? 'Data duplikat (kombinasi RO+tahun+status sudah ada di planning ini)'
                : err.code === 'P2003'
                  ? `RO "${row.kdRO}" tidak valid/tidak ditemukan`
                  : err.message?.substring(0, 150) || 'Error tidak diketahui',
          });
        }
      }
    }

    importSessions.delete(dto.sessionId);

    return {
      message: 'Import berhasil diproses',
      createdPlanning,
      updatedPlanning,
      skippedPlanning,
      createdAlokasi,
      skipped: commitErrors.length,
      commitErrors,
    };
  }
}
