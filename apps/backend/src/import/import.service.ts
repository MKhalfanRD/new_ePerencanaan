import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { CommitImportDto } from './dto/import.dto';

/**
 * Parser Excel untuk format `DB.xlsx` (bukan lagi RKA-K/L per-RO/tahun yang
 * lama — lihat docs-planning/audit-restrukturisasi-db-xlsx.md). Satu sheet,
 * dua level: baris pertama tiap grup proyek mengisi kolom 1-12 (blok Proyek),
 * setiap baris (termasuk lanjutannya) mengisi kolom 13-59 (blok Paket, 1
 * baris = 1 Paket).
 */

// Posisi kolom (1-based) sesuai header asli DB.xlsx — lihat
// docs-planning/audit-restrukturisasi-db-xlsx.md §1 untuk daftar lengkapnya.
const COL = {
  kodeProyek: 1,
  namaProyek: 2,
  kdBalai: 3,
  balai: 4,
  kewenangan: 5,
  polaRencana: 6,
  studiLayak: 7,
  ded: 8,
  larap: 9,
  butuhTanah: 10,
  sumberUsulanProyek: 11,
  keterangan: 12,
  kodePaket: 13,
  kdKegiatan: 14,
  kdKRO: 15,
  // 16 = "namaRO. Nomenklatur" — duplikat namaRO (kolom 18), diabaikan
  kdRO: 17,
  namaRO: 18,
  kdKomponen: 19,
  nmKomponen: 20,
  namaPaket: 21,
  jenisPaket: 22,
  masaLaksana: 23,
  volOutput: 24,
  outputSatuan: 25,
  volOutcome: 26,
  outcomeSatuan: 27,
  kotaKabupaten: 28,
  dokLing: 29,
  catatanPembina: 30,
  catatanSspsda: 31,
  pn: 32,
  pp: 33,
  kp: 34,
  pkpn: 35,
  sp: 36,
  isp: 37,
  satuanIsp: 38,
  sk: 39,
  isk: 40,
  satuanIsk: 41,
  iro: 42,
  satuanIro: 43,
  tematikRenja: 44,
  fkb: 45,
  fkw: 46,
  mpa: 47,
  kodeWS: 48,
  namaWilayahSungai: 49,
  kabKota: 50,
  kecamatan: 51,
  long: 52,
  lat: 53,
  rm: 54,
  rmp: 55,
  pln: 56,
  sbsn: 57,
  kpbu: 58,
  total: 59,
} as const;
interface ParsedPaketRow {
  excelRowNumber: number;
  // --- Proyek (carry-forward) ---
  kodeProyek: string;
  namaProyek: string;
  kdBalai: number | null;
  balaiName: string;
  kewenangan: string;
  polaRencana: string;
  tahunStudiLayak?: number;
  tahunDed?: number;
  tahunLarap?: number;
  kebutuhanTanah: boolean;
  sumberUsulanProyekRaw: string;
  keterangan: string;
  // --- Paket ---
  kodePaket: string;
  kdKegiatan: string;
  kdKRO: string;
  kdRO: string;
  namaRO: string;
  kdKomponen: string;
  nmKomponen: string;
  namaPaket: string;
  jenisPaket: 'FISIK' | 'NON_FISIK';
  masaLaksana: 'SINGLE_YEAR' | 'MULTI_YEAR';
  volOutput?: number;
  outputSatuan?: string;
  volOutcome?: number;
  outcomeSatuan?: string;
  kotaKabupaten?: string;
  dokLing?: string;
  catatanPembina?: string;
  catatanSspsda?: string;
  pn?: string;
  pp?: string;
  kp?: string;
  pkpn?: string;
  sp?: string;
  isp?: string;
  satuanIsp?: string;
  sk?: string;
  isk?: string;
  satuanIsk?: string;
  iro?: string;
  satuanIro?: string;
  tematikRenja?: string;
  fkb: boolean;
  fkw: boolean;
  mpa: boolean;
  kodeWS?: string;
  namaWilayahSungai?: string;
  kabKota?: string;
  kecamatan?: string;
  long?: number;
  lat?: number;
  rm: number;
  rmp: number;
  pln: number;
  sbsn: number;
  kpbu: number;
  total: number;
}

export interface ImportError {
  excelRowNumber: number;
  namaProyek: string;
  balaiName: string;
  reason: string;
}

const importSessions = new Map<
  string,
  { rows: ParsedPaketRow[]; createdAt: number }
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

// Excel sering nyimpen kode ("`001") dengan backtick di depan supaya angka
// nol di depan tidak hilang — bukan bagian dari kodenya.
function cleanCode(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).trim().replace(/^`/, '');
}
function str(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}
function num(v: any): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function bool(v: any): boolean {
  // FKB/FKW/MPA di source cuma diisi kalau "aktif" (kadang malah isinya
  // catatan bebas alih-alih TRUE/FALSE) — jadi cukup dianggap true kalau
  // selnya terisi apa pun, false kalau kosong.
  return v !== null && v !== undefined && String(v).trim() !== '';
}

function parseJenisPaket(raw: string): 'FISIK' | 'NON_FISIK' | null {
  const v = raw.trim().toUpperCase();
  if (v === 'F' || v === 'FISIK') return 'FISIK';
  if (v === 'NF' || v === 'NON_FISIK' || v === 'NON-FISIK' || v === 'NON FISIK')
    return 'NON_FISIK';
  return null;
}

function parseMasaLaksana(raw: string): 'SINGLE_YEAR' | 'MULTI_YEAR' | null {
  const v = raw.trim().toLowerCase();
  if (v.includes('single')) return 'SINGLE_YEAR';
  if (v.includes('multi')) return 'MULTI_YEAR';
  return null;
}

function parseButuhTanah(raw: string): boolean {
  // Sample data: "Tidak memerlukan lahan" -> false. Default true kalau
  // ada isinya tapi tidak jelas-jelas bilang "tidak".
  const v = raw.trim().toLowerCase();
  if (!v) return false;
  return !v.includes('tidak');
}

const SUMBER_USULAN_KEYWORDS: [string, string][] = [
  ['pemerintah daerah', 'PEMERINTAH_DAERAH'],
  ['kementrian', 'KEMENTERIAN_LEMBAGA'],
  ['kementerian', 'KEMENTERIAN_LEMBAGA'],
  ['lembaga', 'KEMENTERIAN_LEMBAGA'],
  ['masyarakat', 'MASYARAKAT'],
  ['tindak lanjut', 'TINDAK_LANJUT_RENAKSI'],
  ['renaksi', 'TINDAK_LANJUT_RENAKSI'],
  ['renduk', 'TINDAK_LANJUT_RENAKSI'],
  ['masterplan', 'TINDAK_LANJUT_RENAKSI'],
];

/**
 * Kolom "Sumber Usulan Proyek" di source kadang diisi dengan menyalin utuh
 * seluruh daftar pilihan (bukan memilih satu) — data kotor, bukan bug parser
 * (lihat docs-planning/audit-restrukturisasi-db-xlsx.md §0). Dicocokkan best
 * effort lewat keyword pertama yang ketemu; kalau tidak ada yang cocok sama
 * sekali, teksnya disimpan utuh sebagai "LAINNYA" supaya tidak hilang.
 */
function parseSumberUsulan(raw: string): {
  value: string;
  lainnya?: string;
} {
  const v = raw.toLowerCase();
  for (const [kw, code] of SUMBER_USULAN_KEYWORDS) {
    if (v.includes(kw)) return { value: code };
  }
  return { value: 'LAINNYA', lainnya: raw || undefined };
}

@Injectable()
export class ImportService {
  constructor(private prisma: PrismaService) {}

  /** Cari baris header (yang sel pertamanya "KodeProyek") di antara beberapa baris pertama sheet. */
  private findHeaderRowIndex(rows: any[][]): number {
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const first = str(rows[i]?.[0]).toLowerCase();
      if (first === 'kodeproyek') return i;
    }
    throw new BadRequestException(
      'Tidak ketemu baris header "KodeProyek" di 5 baris pertama sheet. Pastikan formatnya sesuai DB.xlsx.',
    );
  }

  private cellsToPaketRow(
    cells: any[],
    excelRowNumber: number,
  ): ParsedPaketRow | null {
    const get = (col: number) => cells[col - 1];

    const jenisPaketRaw = str(get(COL.jenisPaket));
    const jenisPaket = parseJenisPaket(jenisPaketRaw);
    const masaLaksanaRaw = str(get(COL.masaLaksana));
    const masaLaksana = parseMasaLaksana(masaLaksanaRaw);
    if (!jenisPaket || !masaLaksana) return null;

    // Sample data yang jadi acuan (DB.xlsx) kadang salah isi kolom WilayahSungai
    // secara tertukar per baris (namanya nyasar ke kolom KodeWS, kolom
    // NamaWilayahSungai kosong) — bukan pergeseran kolom yang konsisten (sudah
    // dicek langsung tiap kolom, cuma WilayahSungai ini yang polanya berulang
    // & bisa dikenali dengan aman: KodeWS beneran selalu berpola "01.09.A2",
    // kalau isinya bukan pola itu berarti itu sebenarnya nama). Lihat
    // docs-planning/audit-restrukturisasi-db-xlsx.md §0.
    const kodeWSRaw = cleanCode(get(COL.kodeWS));
    const namaWSRaw = str(get(COL.namaWilayahSungai));
    const kodeWSLooksLikeCode = /^\d{2}\.\d{2}\.[A-Z0-9]+$/i.test(kodeWSRaw);
    const namaWilayahSungai =
      namaWSRaw || (kodeWSRaw && !kodeWSLooksLikeCode ? kodeWSRaw : undefined);
    const kodeWS = kodeWSLooksLikeCode ? kodeWSRaw : undefined;

    return {
      excelRowNumber,
      kodeProyek: cleanCode(get(COL.kodeProyek)),
      namaProyek: str(get(COL.namaProyek)),
      kdBalai: num(get(COL.kdBalai)) ?? null,
      balaiName: str(get(COL.balai)),
      kewenangan: str(get(COL.kewenangan)),
      polaRencana: str(get(COL.polaRencana)),
      tahunStudiLayak: num(get(COL.studiLayak)),
      tahunDed: num(get(COL.ded)),
      tahunLarap: num(get(COL.larap)),
      kebutuhanTanah: parseButuhTanah(str(get(COL.butuhTanah))),
      sumberUsulanProyekRaw: str(get(COL.sumberUsulanProyek)),
      keterangan: str(get(COL.keterangan)),

      kodePaket: cleanCode(get(COL.kodePaket)),
      kdKegiatan: cleanCode(get(COL.kdKegiatan)),
      kdKRO: cleanCode(get(COL.kdKRO)),
      kdRO: cleanCode(get(COL.kdRO)),
      namaRO: str(get(COL.namaRO)),
      kdKomponen: cleanCode(get(COL.kdKomponen)),
      nmKomponen: str(get(COL.nmKomponen)),
      namaPaket: str(get(COL.namaPaket)),
      jenisPaket,
      masaLaksana,
      volOutput: num(get(COL.volOutput)),
      outputSatuan: str(get(COL.outputSatuan)) || undefined,
      volOutcome: num(get(COL.volOutcome)),
      outcomeSatuan: str(get(COL.outcomeSatuan)) || undefined,
      kotaKabupaten: str(get(COL.kotaKabupaten)) || undefined,
      dokLing: str(get(COL.dokLing)) || undefined,
      catatanPembina: str(get(COL.catatanPembina)) || undefined,
      catatanSspsda: str(get(COL.catatanSspsda)) || undefined,
      pn: str(get(COL.pn)) || undefined,
      pp: str(get(COL.pp)) || undefined,
      kp: str(get(COL.kp)) || undefined,
      pkpn: str(get(COL.pkpn)) || undefined,
      sp: str(get(COL.sp)) || undefined,
      isp: str(get(COL.isp)) || undefined,
      satuanIsp: str(get(COL.satuanIsp)) || undefined,
      sk: str(get(COL.sk)) || undefined,
      isk: str(get(COL.isk)) || undefined,
      satuanIsk: str(get(COL.satuanIsk)) || undefined,
      iro: str(get(COL.iro)) || undefined,
      satuanIro: str(get(COL.satuanIro)) || undefined,
      tematikRenja: str(get(COL.tematikRenja)) || undefined,
      fkb: bool(get(COL.fkb)),
      fkw: bool(get(COL.fkw)),
      mpa: bool(get(COL.mpa)),
      kodeWS,
      namaWilayahSungai,
      kabKota: str(get(COL.kabKota)) || undefined,
      kecamatan: str(get(COL.kecamatan)) || undefined,
      long: num(get(COL.long)),
      lat: num(get(COL.lat)),
      rm: num(get(COL.rm)) ?? 0,
      rmp: num(get(COL.rmp)) ?? 0,
      pln: num(get(COL.pln)) ?? 0,
      sbsn: num(get(COL.sbsn)) ?? 0,
      kpbu: num(get(COL.kpbu)) ?? 0,
      total: num(get(COL.total)) ?? 0,
    };
  }

  async preview(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
    });

    const headerIdx = this.findHeaderRowIndex(rawRows);
    const dataRows = rawRows.slice(headerIdx + 1);

    const parsedRows: ParsedPaketRow[] = [];
    const parseErrors: ImportError[] = [];

    // State carry-forward blok Proyek (cuma terisi di baris pertama grup)
    let current: Pick<
      ParsedPaketRow,
      | 'kodeProyek'
      | 'namaProyek'
      | 'kdBalai'
      | 'balaiName'
      | 'kewenangan'
      | 'polaRencana'
      | 'tahunStudiLayak'
      | 'tahunDed'
      | 'tahunLarap'
      | 'kebutuhanTanah'
      | 'sumberUsulanProyekRaw'
      | 'keterangan'
    > | null = null;

    dataRows.forEach((row, i) => {
      const excelRowNumber = headerIdx + 2 + i;
      if (!row || row.every((c) => c === null || c === '')) return; // baris kosong total

      const parsed = this.cellsToPaketRow(row, excelRowNumber);
      if (!parsed) {
        parseErrors.push({
          excelRowNumber,
          namaProyek: current?.namaProyek || '(kosong)',
          balaiName: current?.balaiName || '(kosong)',
          reason: 'Kolom "Jenis Paket (F/NF)" atau "MasaLaksana" tidak valid/kosong',
        });
        return;
      }

      // Baris pertama grup: kolom Proyek terisi -> update carry-forward state
      if (parsed.kodeProyek || parsed.namaProyek) {
        current = {
          kodeProyek: parsed.kodeProyek,
          namaProyek: parsed.namaProyek,
          kdBalai: parsed.kdBalai,
          balaiName: parsed.balaiName,
          kewenangan: parsed.kewenangan,
          polaRencana: parsed.polaRencana,
          tahunStudiLayak: parsed.tahunStudiLayak,
          tahunDed: parsed.tahunDed,
          tahunLarap: parsed.tahunLarap,
          kebutuhanTanah: parsed.kebutuhanTanah,
          sumberUsulanProyekRaw: parsed.sumberUsulanProyekRaw,
          keterangan: parsed.keterangan,
        };
      } else if (current) {
        Object.assign(parsed, current);
      } else {
        parseErrors.push({
          excelRowNumber,
          namaProyek: '(kosong)',
          balaiName: '(kosong)',
          reason:
            'Baris Paket tanpa proyek induk (KodeProyek/Nama Proyek belum pernah terisi sebelumnya)',
        });
        return;
      }

      if (!parsed.namaPaket || !parsed.kdKegiatan || !parsed.kdRO) {
        parseErrors.push({
          excelRowNumber,
          namaProyek: parsed.namaProyek,
          balaiName: parsed.balaiName,
          reason: 'NamaPaket / KdKegiatan / kdRO kosong',
        });
        return;
      }

      parsedRows.push(parsed);
    });

    if (parsedRows.length === 0) {
      throw new BadRequestException(
        'Tidak ada baris Paket valid ditemukan di file Excel.',
      );
    }

    // ===== Deteksi Balai — cocokkan dulu via KdBalai (id persis), baru fallback fuzzy nama =====
    const groups = this.groupRows(parsedRows);
    const balaiCandidates = new Map<string, { kdBalai: number | null; name: string }>();
    for (const g of groups.values()) {
      const first = g[0];
      balaiCandidates.set(first.balaiName, {
        kdBalai: first.kdBalai,
        name: first.balaiName,
      });
    }
    const existingBalai = await this.prisma.balai.findMany();

    const matched: { excelName: string; balaiId: number; balaiName: string }[] =
      [];
    const unmatched: {
      excelName: string;
      suggestions: { id: number; name: string; score: number }[];
    }[] = [];

    for (const { kdBalai, name } of balaiCandidates.values()) {
      const byId = kdBalai != null ? existingBalai.find((b) => b.id === kdBalai) : undefined;
      if (byId) {
        matched.push({ excelName: name, balaiId: byId.id, balaiName: byId.name });
        continue;
      }
      const byName = existingBalai.find(
        (b) => normalizeBalaiName(b.name) === normalizeBalaiName(name),
      );
      if (byName) {
        matched.push({ excelName: name, balaiId: byName.id, balaiName: byName.name });
        continue;
      }
      const suggestions = existingBalai
        .map((b) => ({ id: b.id, name: b.name, score: similarity(name, b.name) }))
        .filter((s) => s.score >= 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      unmatched.push({ excelName: name, suggestions });
    }

    // ===== Deteksi proyek yang sudah ada (by kodeProyek) =====
    const existingPlannings: {
      groupKey: string;
      namaProyek: string;
      balaiName: string;
      existingId: string;
      existingPaketCount: number;
      existingTotal: number;
      newPaketCount: number;
      newTotal: number;
    }[] = [];

    for (const [groupKey, rows] of groups) {
      const first = rows[0];
      if (!first.kodeProyek) continue; // tanpa KodeProyek tidak bisa dicek duplikat
      const existing = await this.prisma.planning.findFirst({
        where: { kodeProyek: first.kodeProyek, deletedAt: null },
        include: { paket: { include: { alokasi: true } } },
      });
      if (existing) {
        const existingTotal = existing.paket
          .flatMap((p) => p.alokasi)
          .reduce((s, a) => s + Number(a.total), 0);
        existingPlannings.push({
          groupKey,
          namaProyek: first.namaProyek,
          balaiName: first.balaiName,
          existingId: existing.id,
          existingPaketCount: existing.paket.length,
          existingTotal,
          newPaketCount: rows.length,
          newTotal: rows.reduce((s, r) => s + r.total, 0),
        });
      }
    }

    const sessionId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    importSessions.set(sessionId, { rows: parsedRows, createdAt: Date.now() });

    return {
      sessionId,
      summary: {
        totalRowsExcel: parsedRows.length + parseErrors.length,
        totalRowsValid: parsedRows.length,
        totalRowsError: parseErrors.length,
        totalPlanning: groups.size,
        totalPlanningBaru: groups.size - existingPlannings.length,
        totalPlanningDuplikat: existingPlannings.length,
        totalBalaiTerdeteksi: balaiCandidates.size,
        totalBalaiMatched: matched.length,
        totalBalaiUnmatched: unmatched.length,
      },
      matched,
      unmatched,
      existingPlannings,
      parseErrors,
    };
  }

  /** Group key: KodeProyek kalau ada, fallback balaiName|namaProyek. */
  private groupRows(rows: ParsedPaketRow[]): Map<string, ParsedPaketRow[]> {
    const groups = new Map<string, ParsedPaketRow[]>();
    for (const row of rows) {
      const key = row.kodeProyek || `${row.balaiName}|${row.namaProyek}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return groups;
  }

  async commit(dto: CommitImportDto, userId: string) {
    const session = importSessions.get(dto.sessionId);
    if (!session) {
      throw new NotFoundException(
        'Sesi import sudah tidak berlaku, silakan upload ulang file Excel',
      );
    }
    const { rows } = session;
    const commitErrors: ImportError[] = [];

    // ===== Resolve balai =====
    const balaiMap = new Map<string, number>();
    for (const res of dto.balaiResolutions) {
      if (res.useExistingBalaiId) {
        balaiMap.set(res.excelName, res.useExistingBalaiId);
      } else if (res.createNew) {
        const row = rows.find((r) => r.balaiName === res.excelName);
        const newId =
          row?.kdBalai ??
          ((await this.prisma.balai.findFirst({ orderBy: { id: 'desc' } }))
            ?.id ?? 0) + 1;
        const newBalai = await this.prisma.balai.upsert({
          where: { id: newId },
          update: {},
          create: { id: newId, name: res.excelName },
        });
        balaiMap.set(res.excelName, newBalai.id);
      }
    }
    const unresolvedBalai = [...new Set(rows.map((r) => r.balaiName))].filter(
      (name) => !balaiMap.has(name),
    );
    if (unresolvedBalai.length > 0) {
      throw new BadRequestException(
        `Balai berikut belum diselesaikan: ${unresolvedBalai.join(', ')}`,
      );
    }

    // ===== Master data cache (hindari query berulang per baris) =====
    const roCache = new Map<string, string | null>(); // qualifiedRoId -> RO.id atau null (tidak ketemu)
    const resolveRoId = async (row: ParsedPaketRow): Promise<string | null> => {
      const qualified = `${row.kdKegiatan}.${row.kdKRO}.${row.kdRO}`;
      if (!roCache.has(qualified)) {
        const ro = await this.prisma.rO.findUnique({ where: { id: qualified } });
        roCache.set(qualified, ro?.id ?? null);
      }
      return roCache.get(qualified)!;
    };

    const komponenCache = new Map<string, string>(); // `${roId}|${code}` -> Komponen.id
    const resolveKomponenId = async (
      roId: string,
      code: string,
      name: string,
    ): Promise<string | undefined> => {
      if (!code) return undefined;
      const key = `${roId}|${code}`;
      if (komponenCache.has(key)) return komponenCache.get(key);
      let komponen = await this.prisma.komponen.findFirst({
        where: { roId, code },
      });
      if (!komponen) {
        // Komponen jauh lebih granular & spesifik per paket dibanding RO —
        // aman dibuat otomatis saat import (beda dgn RO yg wajib sudah ada
        // di master). Lihat docs-planning/fitur-paket/02-backend.md §6.
        komponen = await this.prisma.komponen.create({
          data: { roId, code, name: name || code },
        });
      }
      komponenCache.set(key, komponen.id);
      return komponen.id;
    };

    const wilayahSungaiCache = new Map<string, string>();
    const resolveWilayahSungaiId = async (
      name: string,
    ): Promise<string | undefined> => {
      if (!name) return undefined;
      const key = name.toLowerCase();
      if (wilayahSungaiCache.has(key)) return wilayahSungaiCache.get(key);
      let ws = await this.prisma.wilayahSungai.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });
      if (!ws) ws = await this.prisma.wilayahSungai.create({ data: { name } });
      wilayahSungaiCache.set(key, ws.id);
      return ws.id;
    };

    const pkpnCache = new Map<string, string>();
    const resolvePkpnId = async (name: string): Promise<string | undefined> => {
      if (!name) return undefined;
      const key = name.toLowerCase();
      if (pkpnCache.has(key)) return pkpnCache.get(key);
      const p = await this.prisma.pkpn.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      pkpnCache.set(key, p.id);
      return p.id;
    };

    const tematikCache = new Map<string, string>();
    const resolveTematikId = async (name: string): Promise<string | undefined> => {
      if (!name) return undefined;
      const key = name.toLowerCase();
      if (tematikCache.has(key)) return tematikCache.get(key);
      const t = await this.prisma.tematikRenja.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      tematikCache.set(key, t.id);
      return t.id;
    };

    const indikatorRoCache = new Map<string, string>();
    const resolveIndikatorRoId = async (
      roId: string,
      nama: string,
      satuan: string,
    ): Promise<string | undefined> => {
      if (!nama) return undefined;
      const key = `${roId}|${nama.toLowerCase()}`;
      if (indikatorRoCache.has(key)) return indikatorRoCache.get(key);
      let ind = await this.prisma.indikatorRO.findFirst({
        where: { roId, nama: { equals: nama, mode: 'insensitive' } },
      });
      if (!ind) {
        ind = await this.prisma.indikatorRO.create({
          data: { roId, nama, satuan: satuan || '-' },
        });
      }
      indikatorRoCache.set(key, ind.id);
      return ind.id;
    };

    // KegiatanPrioritas & Indikator Sasaran Program/Kegiatan sengaja TIDAK
    // auto-create — butuh hierarki (PN>PP>KP, SP>ISP, SK>ISK) yang tidak
    // bisa direkonstruksi aman cuma dari satu kolom teks. Kalau tidak
    // ketemu, dibiarkan null (bukan row error — field opsional).
    const resolveKegiatanPrioritasId = async (
      kp: string,
    ): Promise<string | undefined> => {
      if (!kp) return undefined;
      const found = await this.prisma.kegiatanPrioritas.findFirst({
        where: {
          OR: [
            { code: kp },
            { name: { contains: kp, mode: 'insensitive' } },
          ],
        },
      });
      return found?.id;
    };
    const resolveIspId = async (
      roId: string,
      isp: string,
    ): Promise<string | undefined> => {
      if (!isp) return undefined;
      const ro = await this.prisma.rO.findUnique({
        where: { id: roId },
        include: { kro: { include: { kegiatan: true } } },
      });
      if (!ro) return undefined;
      const found = await this.prisma.indikatorSasaranProgram.findFirst({
        where: {
          name: { contains: isp, mode: 'insensitive' },
          sasaranProgram: { programId: ro.kro.kegiatan.programId },
        },
      });
      return found?.id;
    };
    const resolveIskId = async (
      kegiatanId: string,
      isk: string,
    ): Promise<string | undefined> => {
      if (!isk) return undefined;
      const found = await this.prisma.indikatorSasaranKegiatan.findFirst({
        where: {
          name: { contains: isk, mode: 'insensitive' },
          sasaranKegiatan: { kegiatanId },
        },
      });
      return found?.id;
    };

    // ===== Bangun payload Paket per baris (lintas grup, dipakai saat create maupun replace) =====
    const buildPaketData = async (row: ParsedPaketRow) => {
      const roId = await resolveRoId(row);
      if (!roId) {
        commitErrors.push({
          excelRowNumber: row.excelRowNumber,
          namaProyek: row.namaProyek,
          balaiName: row.balaiName,
          reason: `RO "${row.kdKegiatan}.${row.kdKRO}.${row.kdRO}" tidak ditemukan di master nomenklatur`,
        });
        return null;
      }

      const [
        komponenId,
        wilayahSungaiId,
        pkpnId,
        tematikRenjaId,
        indikatorRoId,
        kegiatanPrioritasId,
        indikatorSasaranProgramId,
        indikatorSasaranKegiatanId,
      ] = await Promise.all([
        resolveKomponenId(roId, row.kdKomponen, row.nmKomponen),
        resolveWilayahSungaiId(row.namaWilayahSungai || ''),
        resolvePkpnId(row.pkpn || ''),
        resolveTematikId(row.tematikRenja || ''),
        resolveIndikatorRoId(roId, row.iro || '', row.satuanIro || ''),
        resolveKegiatanPrioritasId(row.kp || ''),
        resolveIspId(roId, row.isp || ''),
        resolveIskId(row.kdKegiatan, row.isk || ''),
      ]);

      return {
        kodePaket: row.kodePaket || undefined,
        name: row.namaPaket,
        roId,
        komponenId,
        jenis: row.jenisPaket as any,
        masaPelaksanaan: row.masaLaksana as any,
        wilayahSungaiId,
        dokLingStatus: row.dokLing,
        catatanPembina: row.catatanPembina,
        catatanSspsda: row.catatanSspsda,
        kegiatanPrioritasId,
        pkpnId,
        indikatorSasaranProgramId,
        indikatorSasaranKegiatanId,
        indikatorRoId,
        tematikRenjaId,
        fkb: row.fkb,
        fkw: row.fkw,
        mpa: row.mpa,
        alokasi: {
          create: [
            {
              tahun: dto.tahun,
              status: dto.status as any,
              rm: row.rm,
              rmp: row.rmp,
              pln: row.pln,
              sbsn: row.sbsn,
              kpbu: row.kpbu,
              total: row.total || row.rm + row.rmp + row.pln + row.sbsn + row.kpbu,
              outputTarget: row.volOutput,
              outputUnit: row.outputSatuan,
              outcomeTarget: row.volOutcome,
              outcomeUnit: row.outcomeSatuan,
              catatan: 'Hasil import dari Excel',
              lokasi:
                row.kotaKabupaten || row.kabKota || row.kecamatan || row.lat
                  ? {
                      create: [
                        {
                          tipeKoordinat: 'TITIK' as const,
                          cityName: row.kabKota || row.kotaKabupaten,
                          districtName: row.kecamatan,
                          latitude: row.lat,
                          longitude: row.long,
                        },
                      ],
                    }
                  : undefined,
            },
          ],
        },
      };
    };

    // ===== Commit per grup =====
    const groups = this.groupRows(rows);
    const decisions = new Map<string, 'skip' | 'replace'>();
    for (const pr of dto.planningResolutions ?? []) {
      decisions.set(pr.groupKey, pr.action);
    }

    let createdPlanning = 0;
    let updatedPlanning = 0;
    let skippedPlanning = 0;
    let createdPaket = 0;

    for (const [groupKey, groupRows] of groups) {
      const first = groupRows[0];
      const balaiId = balaiMap.get(first.balaiName)!;

      const existing = first.kodeProyek
        ? await this.prisma.planning.findFirst({
            where: { kodeProyek: first.kodeProyek, deletedAt: null },
          })
        : null;

      if (existing) {
        const decision = decisions.get(groupKey) ?? 'skip';
        if (decision === 'skip') {
          skippedPlanning++;
          continue;
        }
        try {
          const paketData = (
            await Promise.all(groupRows.map(buildPaketData))
          ).filter((p): p is NonNullable<typeof p> => p !== null);
          const sumberUsulanReplace = parseSumberUsulan(
            first.sumberUsulanProyekRaw,
          );
          // onDelete: Cascade di Alokasi/LokasiAlokasi ikut membersihkan
          await this.prisma.paket.deleteMany({ where: { planningId: existing.id } });
          await this.prisma.planning.update({
            where: { id: existing.id },
            data: {
              projectName: first.namaProyek,
              balaiId,
              kewenangan: (first.kewenangan || 'PUSAT') as any,
              polaRencana: first.polaRencana || undefined,
              tahunStudiLayak: first.tahunStudiLayak,
              tahunDed: first.tahunDed,
              tahunLarap: first.tahunLarap,
              kebutuhanTanah: first.kebutuhanTanah,
              catatan: first.keterangan || undefined,
              sumberUsulanProyek: sumberUsulanReplace.value as any,
              sumberUsulanLainnya: sumberUsulanReplace.lainnya,
              paket: { create: paketData as any },
            },
          });
          updatedPlanning++;
          createdPaket += paketData.length;
        } catch (err: any) {
          commitErrors.push({
            excelRowNumber: first.excelRowNumber,
            namaProyek: first.namaProyek,
            balaiName: first.balaiName,
            reason: err.message?.substring(0, 150) || 'Gagal replace data',
          });
        }
        continue;
      }

      // Proyek baru
      try {
        const paketData = (
          await Promise.all(groupRows.map(buildPaketData))
        ).filter((p): p is NonNullable<typeof p> => p !== null);
        const sumberUsulan = parseSumberUsulan(first.sumberUsulanProyekRaw);
        await this.prisma.planning.create({
          data: {
            kodeProyek: first.kodeProyek || undefined,
            projectName: first.namaProyek,
            balaiId,
            periodeId: await this.resolvePeriodeId(dto.tahun),
            kewenangan: (first.kewenangan || 'PUSAT') as any,
            polaRencana: first.polaRencana || undefined,
            tahunStudiLayak: first.tahunStudiLayak,
            tahunDed: first.tahunDed,
            tahunLarap: first.tahunLarap,
            kebutuhanTanah: first.kebutuhanTanah,
            catatan: first.keterangan || undefined,
            sumberUsulanProyek: sumberUsulan.value as any,
            sumberUsulanLainnya: sumberUsulan.lainnya,
            status: 'DRAFT',
            createdById: userId,
            paket: { create: paketData as any },
          },
        });
        createdPlanning++;
        createdPaket += paketData.length;
      } catch (err: any) {
        commitErrors.push({
          excelRowNumber: first.excelRowNumber,
          namaProyek: first.namaProyek,
          balaiName: first.balaiName,
          reason:
            err.code === 'P2002'
              ? 'KodeProyek duplikat'
              : err.message?.substring(0, 150) || 'Error tidak diketahui',
        });
      }
    }

    importSessions.delete(dto.sessionId);

    return {
      message: 'Import berhasil diproses',
      createdPlanning,
      updatedPlanning,
      skippedPlanning,
      createdPaket,
      skipped: commitErrors.length,
      commitErrors,
    };
  }

  /** Cari/ buat Periode yang mencakup tahun anggaran import (dipilih user di dialog commit). */
  private async resolvePeriodeId(tahun: number): Promise<number> {
    let periode = await this.prisma.periode.findFirst({
      where: { startYear: { lte: tahun }, endYear: { gte: tahun } },
    });
    if (!periode) {
      periode = await this.prisma.periode.create({
        data: { startYear: tahun, endYear: tahun, label: String(tahun) },
      });
    }
    return periode.id;
  }
}
