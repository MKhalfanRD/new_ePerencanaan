import { Prisma } from '@prisma/client';

/**
 * Skor MCA sebuah proyek: untuk tiap metode, jumlah score item yang
 * dicentang dibagi total score seluruh item metode itu, dikali bobot
 * metode. Persis rumus kolom "bobot" di excel (mis. Urgensitas Irwa:
 * score 2 dari maksimum 11 → 2/11 × 0,4 = 0,0727).
 *
 * Bobot per metode sekarang master data (`MetodeEvaluasi.bobot`), bukan
 * konstanta di kode — lihat docs-planning kalau ada perubahan bobot.
 *
 * `semuaItem` = seluruh item milik kegiatan yang dievaluasi (penyebut),
 * `dicentang` = subset yang ditandai user, `bobotMetode` = peta metodeId
 * -> bobot (0..1) dari master data. Hasil 0..1.
 */
type ItemSkor = { metodeId: string; score: number };

export function hitungSkorEvaluasi(
  semuaItem: ItemSkor[],
  dicentang: ItemSkor[],
  bobotMetode: Map<string, number>,
): number {
  let total = 0;
  for (const [metodeId, bobot] of bobotMetode) {
    const maks = semuaItem
      .filter((i) => i.metodeId === metodeId)
      .reduce((s, i) => s + i.score, 0);
    if (maks <= 0) continue;
    const dapat = dicentang
      .filter((i) => i.metodeId === metodeId)
      .reduce((s, i) => s + i.score, 0);
    total += (dapat / maks) * bobot;
  }
  // 4 desimal — sama dengan presisi kolom skorEvaluasi di schema.
  return Math.round(total * 10000) / 10000;
}

/**
 * Ambil item yang dicentang, pastikan semuanya dari kegiatan yang sama,
 * lalu hitung skornya terhadap seluruh item kegiatan tersebut & bobot
 * metode saat ini. Item id yang tidak dikenal diabaikan (bukan error)
 * supaya form lama tidak bikin submit gagal total.
 */
export async function skorDariItemIds(
  tx: Prisma.TransactionClient,
  itemIds: string[],
): Promise<number | null> {
  if (!itemIds?.length) return null;

  const dicentang = await tx.evaluasiItem.findMany({
    where: { id: { in: itemIds } },
    select: { metodeId: true, score: true, kegiatanId: true },
  });
  if (!dicentang.length) return null;

  const kegiatanIds = [...new Set(dicentang.map((i) => i.kegiatanId))];
  const [semuaItem, metodeList] = await Promise.all([
    tx.evaluasiItem.findMany({
      where: { kegiatanId: { in: kegiatanIds } },
      select: { metodeId: true, score: true },
    }),
    tx.metodeEvaluasi.findMany({ select: { id: true, bobot: true } }),
  ]);
  const bobotMetode = new Map(metodeList.map((m) => [m.id, m.bobot]));

  return hitungSkorEvaluasi(semuaItem, dicentang, bobotMetode);
}

// Self-check: angka contoh "Pembangunan proyek irigasi ABC" di sheet
// "evaluasi Irwa" (referensi 1.xlsx baris 28-32).
//   npx ts-node src/proyek/evaluasi-skor.ts
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    strictEqual,
  }: { strictEqual: (a: unknown, b: unknown) => void } = require('assert');
  const item = (metodeId: string, score: number) => ({ metodeId, score });
  const bobotMetode = new Map([
    ['URGENSITAS', 0.4],
    ['KESIAPAN_TEKNIS', 0.2],
    ['TEMATIK', 0.2],
    ['VALUASI', 0.2],
  ]);
  const semua = [
    ...[1, 1, 1, 1, 1, 2, 2, 2].map((s) => item('URGENSITAS', s)), // maks 11
    ...[2, 1, 2].map((s) => item('KESIAPAN_TEKNIS', s)), // maks 5
    ...[1, 1, 1, 1, 1, 1, 1, 1].map((s) => item('TEMATIK', s)), // maks 8
    ...[2, 2, 2, 1, 1, 1, 1, 1].map((s) => item('VALUASI', s)), // maks 11
  ];

  // Urgensitas 2/11, Kesiapan 3/5, Tematik 3/8, Valuasi 0.
  strictEqual(
    hitungSkorEvaluasi(
      semua,
      [
        item('URGENSITAS', 1),
        item('URGENSITAS', 1),
        item('KESIAPAN_TEKNIS', 2),
        item('KESIAPAN_TEKNIS', 1),
        item('TEMATIK', 1),
        item('TEMATIK', 1),
        item('TEMATIK', 1),
      ],
      bobotMetode,
    ),
    0.2677, // = 0,0727 + 0,12 + 0,075 + 0 — sama dengan sel "Total score"
  );

  strictEqual(hitungSkorEvaluasi(semua, [], bobotMetode), 0);
  strictEqual(hitungSkorEvaluasi(semua, semua, bobotMetode), 1);
  // Metode tanpa item sama sekali tidak boleh bikin NaN.
  strictEqual(hitungSkorEvaluasi([], [], bobotMetode), 0);
  strictEqual(hitungSkorEvaluasi([], [], new Map()), 0);
  console.log('evaluasi-skor OK');
}
