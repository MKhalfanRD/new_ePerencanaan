import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Aturan saldo anggaran kegiatan per tahun (flowchart-saldo-kegiatan.pdf):
 * - Terpakai = Σ alokasi RENCANA semua paket aktif semua proyek kegiatan itu
 *   (termasuk Draft).
 * - Simpanan ditolak hanya kalau MENAMBAH pemakaian suatu tahun dan hasilnya
 *   melebihi saldo, atau tahun itu belum punya saldo. Mengurangi selalu boleh.
 * - Pecahan sumber dana (opsional) dicek sendiri; yang tidak dipecah cukup
 *   terhadap total.
 */
export const SUMBER = ['rm', 'rmp', 'pln', 'sbsn', 'kpbu'] as const;
export type Sumber = (typeof SUMBER)[number];
export type BarisDana = { tahun: number } & Partial<Record<Sumber, unknown>>;
export type Dana = Record<Sumber | 'total', number>;

const EPS = 1e-6;
const nol = (): Dana => ({ rm: 0, rmp: 0, pln: 0, sbsn: 0, kpbu: 0, total: 0 });

/** Jumlah per tahun (& per sumber dana) dari baris alokasi. */
export function jumlahPerTahun(rows: BarisDana[]): Map<number, Dana> {
  const m = new Map<number, Dana>();
  for (const r of rows) {
    const d = m.get(r.tahun) ?? nol();
    for (const k of SUMBER) {
      d[k] += Number(r[k] ?? 0);
      d.total += Number(r[k] ?? 0);
    }
    m.set(r.tahun, d);
  }
  return m;
}

/** Pemakaian (alokasi RENCANA paket aktif) kegiatan per tahun. */
export async function pemakaianKegiatan(
  tx: Prisma.TransactionClient,
  kegiatanId: string,
  tahun: number[],
  kecualiProyekId?: string,
): Promise<Map<number, Dana>> {
  if (!tahun.length) return new Map();
  const rows = await tx.$queryRaw<BarisDana[]>`
    SELECT a.tahun::int AS tahun, SUM(a.rm) AS rm, SUM(a.rmp) AS rmp, SUM(a.pln) AS pln,
           SUM(a.sbsn) AS sbsn, SUM(a.kpbu) AS kpbu
    FROM alokasi a
    JOIN paket k ON k.id = a."paketId"
    JOIN proyek p ON p.id = k."proyekId"
    WHERE a.status = 'RENCANA' AND k."deletedAt" IS NULL
      AND p."kegiatanId" = ${kegiatanId} AND a.tahun = ANY(${tahun})
      ${kecualiProyekId ? Prisma.sql`AND p.id <> ${kecualiProyekId}` : Prisma.empty}
    GROUP BY a.tahun`;
  return jumlahPerTahun(rows);
}

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

/**
 * Tolak simpanan yang menambah pemakaian melebihi saldo kegiatan.
 * `lama` = baris RENCANA yang sedang diganti (sudah ada di DB), `baru` =
 * penggantinya. Panggil di dalam transaksi yang sama dengan penyimpanannya.
 */
export async function cekSaldoKegiatan(
  tx: Prisma.TransactionClient,
  kegiatanId: string | null | undefined,
  lama: BarisDana[],
  baru: BarisDana[],
) {
  if (!kegiatanId) return;
  const L = jumlahPerTahun(lama);
  const B = jumlahPerTahun(baru);
  const delta = (t: number, k: Sumber | 'total') => (B.get(t)?.[k] ?? 0) - (L.get(t)?.[k] ?? 0);
  const naik = [...B.keys()].filter((t) =>
    (['total', ...SUMBER] as const).some((k) => delta(t, k) > EPS),
  );
  if (!naik.length) return;

  // Dua balai yang menyimpan bersamaan tidak boleh sama-sama lolos.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'saldo:' + kegiatanId}))`;
  const saldo = new Map(
    (await tx.saldoKegiatan.findMany({ where: { kegiatanId, tahun: { in: naik } } })).map((s) => [s.tahun, s]),
  );
  const pakai = await pemakaianKegiatan(tx, kegiatanId, naik);

  const salah: string[] = [];
  for (const t of naik.sort()) {
    const s = saldo.get(t);
    if (!s) {
      salah.push(`Saldo kegiatan ${kegiatanId} tahun ${t} belum ditetapkan admin, alokasi ${t} belum bisa diisi`);
      continue;
    }
    const sesudah = (k: Sumber | 'total') => (pakai.get(t)?.[k] ?? 0) + delta(t, k);
    if (delta(t, 'total') > EPS && sesudah('total') > Number(s.total) + EPS)
      salah.push(`Tahun ${t}: pemakaian kegiatan ${rp(sesudah('total'))} melebihi saldo ${rp(Number(s.total))} (lebih ${rp(sesudah('total') - Number(s.total))})`);
    for (const k of SUMBER)
      if (s[k] != null && delta(t, k) > EPS && sesudah(k) > Number(s[k]) + EPS)
        salah.push(`Tahun ${t}: ${k.toUpperCase()} ${rp(sesudah(k))} melebihi saldo ${k.toUpperCase()} ${rp(Number(s[k]))}`);
  }
  if (salah.length) throw new BadRequestException(salah.join('; '));
}
