import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { SaldoKegiatan } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { LINTAS_KEGIATAN } from '../auth/role';
import { Dana, SUMBER, jumlahPerTahun, pemakaianKegiatan } from './saldo';
import { TetapkanSaldoDto } from './saldo-kegiatan.dto';

/** Saldo siap kirim ke frontend (Decimal -> number, pecahan null = tidak dipecah). */
const keluar = (s: SaldoKegiatan | undefined) =>
  s && {
    total: Number(s.total),
    ...Object.fromEntries(SUMBER.map((k) => [k, s[k] == null ? null : Number(s[k])])),
    alasan: s.alasan,
    updatedAt: s.updatedAt,
  };
const NOL: Dana = { rm: 0, rmp: 0, pln: 0, sbsn: 0, kpbu: 0, total: 0 };

@Injectable()
export class SaldoKegiatanService {
  constructor(private prisma: PrismaService) {}

  /** Kegiatan yang boleh dilihat akun ini (null = semua). */
  private lingkup(user: any): string | null {
    if (LINTAS_KEGIATAN.includes(user?.role)) return null;
    return user?.kegiatanId ?? user?.balaiKegiatanId ?? '__tidak_ada__';
  }
  private cekLingkup(user: any, kegiatanId: string) {
    const l = this.lingkup(user);
    if (l && l !== kegiatanId) throw new ForbiddenException('Kegiatan ini di luar akses akun Anda');
  }

  /** Halaman Anggaran Kegiatan: semua kegiatan 1 tahun + pemakaian per balai. */
  async daftar(user: any, tahun: number) {
    const l = this.lingkup(user);
    const [kegiatan, saldo, pakai] = await Promise.all([
      this.prisma.kegiatan.findMany({ where: l ? { id: l } : {}, orderBy: { id: 'asc' } }),
      this.prisma.saldoKegiatan.findMany({ where: { tahun, ...(l ? { kegiatanId: l } : {}) } }),
      this.prisma.$queryRaw<
        { kegiatanId: string; balaiId: number; proyek: number; rm: unknown; rmp: unknown; pln: unknown; sbsn: unknown; kpbu: unknown }[]
      >`
        SELECT p."kegiatanId", p."balaiId", COUNT(DISTINCT p.id)::int AS proyek,
               SUM(a.rm) AS rm, SUM(a.rmp) AS rmp, SUM(a.pln) AS pln, SUM(a.sbsn) AS sbsn, SUM(a.kpbu) AS kpbu
        FROM alokasi a
        JOIN paket k ON k.id = a."paketId"
        JOIN proyek p ON p.id = k."proyekId"
        WHERE a.status = 'RENCANA' AND k."deletedAt" IS NULL AND a.tahun = ${tahun}
          AND p."kegiatanId" IS NOT NULL
        GROUP BY p."kegiatanId", p."balaiId"`,
    ]);
    const balai = new Map(
      (
        await this.prisma.balai.findMany({
          where: { id: { in: [...new Set(pakai.map((x) => x.balaiId))] } },
          select: { id: true, name: true },
        })
      ).map((b) => [b.id, b.name]),
    );
    const saldoMap = new Map(saldo.map((s) => [s.kegiatanId, s]));
    return kegiatan.map((k) => {
      const baris = pakai.filter((x) => x.kegiatanId === k.id);
      const perBalai = baris
        .map((x) => ({
          balaiId: x.balaiId,
          nama: balai.get(x.balaiId) ?? `Balai ${x.balaiId}`,
          proyek: x.proyek,
          terpakai: jumlahPerTahun([{ ...x, tahun }]).get(tahun) ?? NOL,
        }))
        .sort((a, b) => b.terpakai.total - a.terpakai.total);
      return {
        kegiatanId: k.id,
        kode: k.code,
        nama: k.name,
        saldo: keluar(saldoMap.get(k.id)) ?? null,
        terpakai: jumlahPerTahun(baris.map((x) => ({ ...x, tahun }))).get(tahun) ?? NOL,
        proyek: baris.reduce((s, x) => s + x.proyek, 0),
        balai: perBalai,
      };
    });
  }

  /** Saldo & pemakaian 1 kegiatan per tahun — panel Tetapkan saldo & form paket.
   * `kecualiProyek`: pemakaian proyek itu tidak dihitung (form menjumlah paketnya sendiri). */
  async perTahun(user: any, kegiatanId: string, dari: number, sampai: number, kecualiProyek?: string) {
    this.cekLingkup(user, kegiatanId);
    if (!(dari <= sampai) || sampai - dari > 20) throw new BadRequestException('Rentang tahun tidak valid');
    const tahun = Array.from({ length: sampai - dari + 1 }, (_, i) => dari + i);
    const [saldo, pakai] = await Promise.all([
      this.prisma.saldoKegiatan.findMany({ where: { kegiatanId, tahun: { in: tahun } } }),
      pemakaianKegiatan(this.prisma, kegiatanId, tahun, kecualiProyek),
    ]);
    const s = new Map(saldo.map((x) => [x.tahun, x]));
    return tahun.map((t) => ({ tahun: t, saldo: keluar(s.get(t)) ?? null, terpakai: pakai.get(t) ?? NOL }));
  }

  /** Admin menetapkan saldo beberapa tahun sekaligus. total null = hapus saldo tahun itu. */
  async tetapkan(user: any, kegiatanId: string, dto: TetapkanSaldoDto) {
    const ada = await this.prisma.kegiatan.findUnique({ where: { id: kegiatanId } });
    if (!ada) throw new BadRequestException(`Kegiatan ${kegiatanId} tidak ditemukan`);
    for (const t of dto.tahun) {
      if (t.total == null) continue;
      const dipecah = SUMBER.reduce((s, k) => s + Number(t[k] ?? 0), 0);
      if (dipecah > t.total)
        throw new BadRequestException(
          `Tahun ${t.tahun}: jumlah pecahan sumber dana (Rp ${dipecah.toLocaleString('id-ID')}) melebihi saldo total (Rp ${t.total.toLocaleString('id-ID')})`,
        );
    }
    await this.prisma.$transaction(async (tx) => {
      for (const t of dto.tahun) {
        const where = { kegiatanId_tahun: { kegiatanId, tahun: t.tahun } };
        if (t.total == null) {
          await tx.saldoKegiatan.deleteMany({ where: { kegiatanId, tahun: t.tahun } });
          continue;
        }
        const data = {
          total: t.total,
          ...Object.fromEntries(SUMBER.map((k) => [k, t[k] ?? null])),
          alasan: dto.alasan,
        };
        await tx.saldoKegiatan.upsert({ where, create: { kegiatanId, tahun: t.tahun, ...data }, update: data });
      }
    });
    const tahun = dto.tahun.map((t) => t.tahun);
    return this.perTahun(user, kegiatanId, Math.min(...tahun), Math.max(...tahun));
  }
}
