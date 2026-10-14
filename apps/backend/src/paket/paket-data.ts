import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PaketAlokasiDto, PaketInputDto } from './dto/create-paket.dto';
import { PaketRingkas, ringkasPaket } from '../proyek/form-skor';

/**
 * Aturan paket format baru — dipakai POST/PATCH /paket & Buat Proyek supaya
 * saldo, alokasi per tahun & hak akses satker sama di kedua jalur.
 */

const SUMBER_DANA = ['rm', 'rmp', 'pln', 'sbsn', 'kpbu'] as const;
export const totalAlokasi = (a: Partial<Record<(typeof SUMBER_DANA)[number], unknown>>) =>
  SUMBER_DANA.reduce((s, k) => s + Number(a[k] ?? 0), 0);

/** Kolom tabel Paket dari isian (paket selalu dikirim utuh dari form). */
export function kolomPaket(dto: PaketInputDto) {
  const sendiri = dto.lokasiSamaProyek === false;
  const titik = (dto.tipeKoordinat ?? 'TITIK') === 'TITIK';
  return {
    name: dto.name,
    roId: dto.roId,
    satkerId: dto.satkerId || null,
    lokasiRo: dto.lokasiRo ?? [],
    tahunMulai: dto.tahunMulai ?? null,
    tahunSelesai: dto.tahunSelesai ?? null,
    lokasiSamaProyek: !sendiri,
    tipeKoordinat: sendiri ? ((dto.tipeKoordinat ?? 'TITIK') as any) : null,
    latitude: sendiri && titik ? (dto.latitude ?? null) : null,
    longitude: sendiri && titik ? (dto.longitude ?? null) : null,
    coordinates:
      sendiri && !titik && dto.coordinates?.length ? dto.coordinates : Prisma.DbNull,
    provinceId: sendiri ? (dto.provinceId ?? null) : null,
    provinceName: sendiri ? (dto.provinceName ?? null) : null,
    cityId: sendiri ? (dto.cityId ?? null) : null,
    cityName: sendiri ? (dto.cityName ?? null) : null,
    districtId: sendiri ? (dto.districtId ?? null) : null,
    districtName: sendiri ? (dto.districtName ?? null) : null,
    villageId: sendiri ? (dto.villageId ?? null) : null,
    villageName: sendiri ? (dto.villageName ?? null) : null,
  };
}

/** Rentang tahun & tahun alokasi harus masuk akal. */
export function cekIsianPaket(dto: PaketInputDto) {
  const { tahunMulai: mulai, tahunSelesai: selesai } = dto;
  if (mulai && selesai && mulai > selesai)
    throw new BadRequestException(`Paket "${dto.name}": tahun mulai melebihi tahun selesai`);
  for (const a of dto.alokasi ?? [])
    if ((mulai && a.tahun < mulai) || (selesai && a.tahun > selesai))
      throw new BadRequestException(
        `Paket "${dto.name}": alokasi tahun ${a.tahun} di luar rentang tahun paket`,
      );
}

const barisIro = (dto: PaketInputDto) =>
  dto.indikatorRoId
    ? [{ indikatorRoId: dto.indikatorRoId, satuan: dto.satuanIro || null, order: 0 }]
    : [];

// Pemaketan cuma mengisi alokasi RENCANA. Realisasi fitur terpisah (dibahas
// nanti) — tidak lagi dibuatkan baris REALISASI 0 otomatis.
const barisRencana = (a: PaketAlokasiDto) => ({
  tahun: a.tahun,
  status: 'RENCANA' as const,
  komponenId: a.komponenId || null,
  outputTarget: a.volumeRo ?? null,
  outcomeTarget: a.volumeIro ?? null,
  rm: a.rm ?? 0,
  rmp: a.rmp ?? 0,
  pln: a.pln ?? 0,
  sbsn: a.sbsn ?? 0,
  kpbu: a.kpbu ?? 0,
  total: totalAlokasi(a),
});

/** Nested create utk paket baru: IRO + alokasi RENCANA per tahun. */
export function relasiPaketBaru(dto: PaketInputDto) {
  const iro = barisIro(dto);
  const alokasi = dto.alokasi ?? [];
  return {
    indikatorRo: iro.length ? { create: iro } : undefined,
    alokasi: alokasi.length ? { create: alokasi.map(barisRencana) } : undefined,
  };
}

/** Edit paket: ganti IRO & alokasi RENCANA; tahun di luar rentang dibuang
 * (realisasi yang sudah ada tidak disentuh). */
export async function simpanRelasiPaket(
  tx: Prisma.TransactionClient,
  paketId: string,
  dto: PaketInputDto,
) {
  if (dto.indikatorRoId !== undefined) {
    await tx.paketIndikatorRo.deleteMany({ where: { paketId } });
    const iro = barisIro(dto);
    if (iro.length)
      await tx.paketIndikatorRo.createMany({ data: iro.map((i) => ({ ...i, paketId })) });
  }
  if (dto.alokasi === undefined) return;
  const tahun = dto.alokasi.map((a) => a.tahun);
  await tx.alokasi.deleteMany({
    where: { paketId, status: 'RENCANA', tahun: { notIn: tahun } },
  });
  for (const a of dto.alokasi) {
    const rencana = barisRencana(a);
    await tx.alokasi.upsert({
      where: { paketId_tahun_status: { paketId, tahun: a.tahun, status: 'RENCANA' } },
      create: { paketId, ...rencana },
      update: rencana,
    });
  }
}

/** Ringkasan per tahun dari isian form (jenis komponen dibaca dari master). */
export async function ringkasIsian(
  tx: Prisma.TransactionClient,
  dto: PaketInputDto,
): Promise<PaketRingkas[]> {
  const ids = [...new Set((dto.alokasi ?? []).map((a) => a.komponenId).filter((x): x is string => !!x))];
  const jenis = new Map(
    (await tx.komponen.findMany({ where: { id: { in: ids } }, select: { id: true, jenis: true } })).map(
      (k) => [k.id, k.jenis],
    ),
  );
  return (dto.alokasi ?? []).map((a) => ({
    total: totalAlokasi(a),
    utama: (jenis.get(a.komponenId ?? '') ?? 'UTAMA') === 'UTAMA',
    volumeRo: a.volumeRo ?? 0,
    iro: [{ volume: a.volumeIro ?? 0 }],
  }));
}

const angka = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 4 });

/** Total paket tidak boleh melebihi saldo proyek (saldo kosong = tanpa batas).
 * Anggaran = semua paket; volume = paket berkomponen UTAMA. */
export function cekSaldo(
  saldo: { saldoAnggaran?: unknown; saldoVolumeRo?: unknown; saldoVolumeIro?: unknown },
  paket: PaketRingkas[],
) {
  const r = ringkasPaket(paket);
  const lebih: string[] = [];
  const cek = (nama: string, dipakai: number, batas: unknown, rp = false) => {
    if (batas == null || batas === '') return;
    if (dipakai > Number(batas) + 1e-9)
      lebih.push(`${nama} ${rp ? 'Rp ' : ''}${angka(dipakai)} melebihi saldo ${rp ? 'Rp ' : ''}${angka(Number(batas))}`);
  };
  cek('Total anggaran paket', r.A, saldo.saldoAnggaran, true);
  cek('Total volume RO', r.B, saldo.saldoVolumeRo);
  cek('Total volume IRO', r.C, saldo.saldoVolumeIro);
  if (lebih.length) throw new BadRequestException(lebih.join('; '));
}

const LINTAS_UNIT = ['SUPER_ADMIN', 'ADMINISTRATOR'];
export const lintasUnit = (user: any) =>
  LINTAS_UNIT.includes(user?.role) || LINTAS_UNIT.includes(user?.baseRole);

/**
 * Hak ubah paket per tingkat akun: pusat (tanpa balai) bebas; akun Balai
 * cuma proyek balainya; akun Satker cuma kalau proyek mengizinkan & paket
 * satkernya sendiri.
 */
export function cekAksesPaket(
  user: any,
  proyek: { balaiId: number; satkerBolehUbahPaket: boolean },
  satkerIdPaket?: string | null,
) {
  if (!user?.balaiId || lintasUnit(user)) return;
  if (user.balaiId !== proyek.balaiId)
    throw new ForbiddenException('Proyek ini milik balai lain');
  if (!user.satkerId) return;
  if (!proyek.satkerBolehUbahPaket)
    throw new ForbiddenException('Balai belum mengizinkan satker mengubah paket proyek ini');
  // undefined = paket baru; paket lama harus milik satker akun ini.
  if (satkerIdPaket !== undefined && satkerIdPaket !== user.satkerId)
    throw new ForbiddenException('Paket ini milik satker lain');
}

/** Akun Satker: satker paket selalu satker akunnya. Lainnya: satker harus
 * milik balai proyek. */
export async function satkerPaket(
  tx: Prisma.TransactionClient,
  user: any,
  balaiId: number,
  satkerId: string | undefined,
) {
  if (user?.satkerId && !lintasUnit(user)) return user.satkerId as string;
  if (!satkerId) return undefined;
  const s = await tx.satker.findUnique({ where: { id: satkerId }, select: { balaiId: true } });
  if (!s || s.balaiId !== balaiId)
    throw new BadRequestException('Satker paket tidak termasuk balai proyek');
  return satkerId;
}
