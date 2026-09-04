import { Prisma, PrismaClient } from '@prisma/client';

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Kode Proyek: PR + tahun 2 digit + nomor urut 4 digit, mis. "PR260001".
 * Nomor urut global per tahun, diambil dari kode terbesar yang sudah ada
 * (bukan COUNT, supaya proyek yang terlanjur dihapus tidak membuat nomor
 * dipakai ulang).
 */
export async function generateKodeProyek(tx: Tx): Promise<string> {
  const yy = String(new Date().getFullYear() % 100).padStart(2, '0');
  const prefix = `PR${yy}`;
  const last = await tx.planning.findFirst({
    where: { kodeProyek: { startsWith: prefix } },
    orderBy: { kodeProyek: 'desc' },
    select: { kodeProyek: true },
  });
  const lastSeq = last?.kodeProyek
    ? parseInt(last.kodeProyek.slice(prefix.length), 10) || 0
    : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
}

/**
 * Kode Paket: PA + (tahun+nomor urut proyek dari Kode Proyek-nya, 6 digit)
 * + nomor urut paket 4 digit, mis. proyek "PR260001" -> paket pertama
 * "PA2600010001", paket kedua "PA2600010002".
 */
export async function generateKodePaket(
  tx: Tx,
  kodeProyek: string,
): Promise<string> {
  const proyekPart = kodeProyek.slice(2); // buang prefix "PR"
  const prefix = `PA${proyekPart}`;
  const last = await tx.paket.findFirst({
    where: { kodePaket: { startsWith: prefix } },
    orderBy: { kodePaket: 'desc' },
    select: { kodePaket: true },
  });
  const lastSeq = last?.kodePaket
    ? parseInt(last.kodePaket.slice(prefix.length), 10) || 0
    : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
}
