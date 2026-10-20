import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { LINTAS_KEGIATAN } from '../auth/role';

/**
 * Laporan pimpinan (docs-planning/flowchart-laporan.pdf). Bentuk keluaran
 * seragam {kolom, baris, total} supaya pratinjau layar, PDF & Excel memakai
 * data yang sama persis.
 */
export type JenisLaporan = 'alokasi' | 'proyek' | 'saldo';
export interface Kolom {
  key: string;
  label: string;
  /** rp = rupiah, n = bilangan, pct = persen. */
  jenis: 'rp' | 'n' | 'pct';
}
export interface Baris {
  label: string;
  /** Baris rincian (balai) di bawah baris kegiatan. */
  rincian?: boolean;
  nilai: Record<string, number | null>;
}
export interface Saringan {
  tahun?: number;
  kegiatanId?: string;
  balaiId?: number;
  status?: string;
}

const SD = ['rm', 'rmp', 'pln', 'sbsn', 'kpbu'] as const;
const STATUS = [
  ['DRAFT', 'Draft'],
  ['DIAJUKAN', 'Diajukan'],
  ['DIPERIKSA', 'Diperiksa'],
  ['DIKEMBALIKAN', 'Dikembalikan'],
  ['APPROVED', 'Disetujui'],
] as const;

@Injectable()
export class LaporanService {
  constructor(private prisma: PrismaService) {}

  /** Cakupan akun (keputusan 20 Okt): admin semua; terikat kegiatan; balai; selain itu proyek buatannya. */
  private cakupan(user: any): Prisma.Sql {
    if (LINTAS_KEGIATAN.includes(user?.role)) return Prisma.empty;
    if (user?.kegiatanId) return Prisma.sql`AND p."kegiatanId" = ${user.kegiatanId}`;
    if (user?.balaiId) return Prisma.sql`AND p."balaiId" = ${Number(user.balaiId)}`;
    return Prisma.sql`AND p."createdById" = ${user?.userId ?? '-'}`;
  }

  private saring(s: Saringan): Prisma.Sql {
    const syarat: Prisma.Sql[] = [];
    if (s.kegiatanId) syarat.push(Prisma.sql`AND p."kegiatanId" = ${s.kegiatanId}`);
    if (s.balaiId) syarat.push(Prisma.sql`AND p."balaiId" = ${s.balaiId}`);
    if (s.status) syarat.push(Prisma.sql`AND p.status = ${s.status}::"StatusProyek"`);
    return syarat.length ? Prisma.join(syarat, ' ') : Prisma.empty;
  }

  async buat(jenis: JenisLaporan, s: Saringan, user: any) {
    const where = Prisma.sql`p."deletedAt" IS NULL AND p."kegiatanId" IS NOT NULL ${this.cakupan(user)} ${this.saring(s)}`;
    if (jenis === 'alokasi') return this.alokasi(where, s);
    if (jenis === 'proyek') return this.proyek(where, s);
    if (jenis === 'saldo') return this.saldo(where, s, user);
    throw new BadRequestException('Jenis laporan tidak dikenal');
  }

  /** A. Alokasi rencana & realisasi per kegiatan, per sumber dana. */
  private async alokasi(where: Prisma.Sql, s: Saringan) {
    const rows = await this.prisma.$queryRaw<
      { kegiatanId: string; nama: string; status: string; rm: unknown; rmp: unknown; pln: unknown; sbsn: unknown; kpbu: unknown }[]
    >`
      SELECT p."kegiatanId", g.name AS nama, a.status::text AS status,
             SUM(a.rm) AS rm, SUM(a.rmp) AS rmp, SUM(a.pln) AS pln, SUM(a.sbsn) AS sbsn, SUM(a.kpbu) AS kpbu
      FROM alokasi a
      JOIN paket k ON k.id = a."paketId" AND k."deletedAt" IS NULL
      JOIN proyek p ON p.id = k."proyekId"
      JOIN kegiatan g ON g.id = p."kegiatanId"
      WHERE ${where} ${s.tahun ? Prisma.sql`AND a.tahun = ${s.tahun}` : Prisma.empty}
      GROUP BY p."kegiatanId", g.name, a.status
      ORDER BY p."kegiatanId", a.status DESC`;
    const kolom: Kolom[] = [...SD.map((k) => ({ key: k, label: k.toUpperCase(), jenis: 'rp' as const })), { key: 'total', label: 'Total', jenis: 'rp' }];
    const isi = (r: (typeof rows)[number]) => {
      const n: Record<string, number> = {};
      for (const k of SD) n[k] = Number(r[k] ?? 0);
      n.total = SD.reduce((t, k) => t + n[k], 0);
      return n;
    };
    const baris: Baris[] = rows.map((r) => ({
      label: `${r.kegiatanId} · ${r.status === 'RENCANA' ? 'rencana' : 'realisasi'} · ${r.nama}`,
      nilai: isi(r),
    }));
    const jumlah = (status: string) => {
      const t: Record<string, number> = Object.fromEntries(kolom.map((k) => [k.key, 0]));
      for (const r of rows.filter((x) => x.status === status)) for (const [k, v] of Object.entries(isi(r))) t[k] += v;
      return t;
    };
    return {
      judul: 'Alokasi rencana & realisasi per kegiatan',
      kolom,
      baris,
      total: [
        { label: 'Total rencana', nilai: jumlah('RENCANA') },
        { label: 'Total realisasi', nilai: jumlah('REALISASI') },
      ],
    };
  }

  /** B. Jumlah proyek & paket per kegiatan, dirinci per balai & status. */
  private async proyek(where: Prisma.Sql, s: Saringan) {
    const adaTahun = s.tahun
      ? Prisma.sql`AND EXISTS (SELECT 1 FROM paket k2 JOIN alokasi a2 ON a2."paketId" = k2.id
          WHERE k2."proyekId" = p.id AND k2."deletedAt" IS NULL AND a2.status = 'RENCANA' AND a2.tahun = ${s.tahun})`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      { kegiatanId: string; kegiatan: string; balai: string; status: string; proyek: number; paket: number }[]
    >`
      SELECT p."kegiatanId", g.name AS kegiatan, b.name AS balai, p.status::text AS status,
             COUNT(DISTINCT p.id)::int AS proyek, COUNT(DISTINCT k.id)::int AS paket
      FROM proyek p
      JOIN kegiatan g ON g.id = p."kegiatanId"
      JOIN balai b ON b.id = p."balaiId"
      LEFT JOIN paket k ON k."proyekId" = p.id AND k."deletedAt" IS NULL
      WHERE ${where} ${adaTahun}
      GROUP BY p."kegiatanId", g.name, b.name, p.status
      ORDER BY p."kegiatanId", b.name`;
    const kolom: Kolom[] = [
      { key: 'proyek', label: 'Proyek', jenis: 'n' },
      { key: 'paket', label: 'Paket', jenis: 'n' },
      ...STATUS.map(([k, l]) => ({ key: k, label: l, jenis: 'n' as const })),
    ];
    const kosong = () => Object.fromEntries(kolom.map((k) => [k.key, 0])) as Record<string, number>;
    const tambah = (t: Record<string, number>, r: (typeof rows)[number]) => {
      t.proyek += r.proyek;
      t.paket += r.paket;
      t[r.status] += r.proyek;
    };
    const baris: Baris[] = [];
    const total = kosong();
    for (const keg of [...new Set(rows.map((r) => r.kegiatanId))]) {
      const milik = rows.filter((r) => r.kegiatanId === keg);
      const t = kosong();
      milik.forEach((r) => tambah(t, r));
      milik.forEach((r) => tambah(total, r));
      baris.push({ label: `${keg} · ${milik[0].kegiatan}`, nilai: t });
      for (const balai of [...new Set(milik.map((r) => r.balai))]) {
        const tb = kosong();
        milik.filter((r) => r.balai === balai).forEach((r) => tambah(tb, r));
        baris.push({ label: balai, rincian: true, nilai: tb });
      }
    }
    return { judul: 'Total proyek per kegiatan', kolom, baris, total: [{ label: 'Total', nilai: total }] };
  }

  /** C. Saldo kegiatan (1 tahun), terpakai per balai, sisa. Terpakai memakai realisasi bila sudah diisi. */
  private async saldo(where: Prisma.Sql, s: Saringan, user: any) {
    const tahun = s.tahun ?? new Date().getFullYear();
    const pakai = await this.prisma.$queryRaw<{ kegiatanId: string; balai: string; total: unknown }[]>`
      SELECT p."kegiatanId", b.name AS balai,
             SUM(COALESCE(r.rm, a.rm) + COALESCE(r.rmp, a.rmp) + COALESCE(r.pln, a.pln)
                 + COALESCE(r.sbsn, a.sbsn) + COALESCE(r.kpbu, a.kpbu)) AS total
      FROM alokasi a
      LEFT JOIN alokasi r ON r."paketId" = a."paketId" AND r.tahun = a.tahun AND r.status = 'REALISASI'
      JOIN paket k ON k.id = a."paketId" AND k."deletedAt" IS NULL
      JOIN proyek p ON p.id = k."proyekId"
      JOIN balai b ON b.id = p."balaiId"
      WHERE ${where} AND a.status = 'RENCANA' AND a.tahun = ${tahun}
      GROUP BY p."kegiatanId", b.name
      ORDER BY p."kegiatanId", b.name`;
    const kegiatanIds = [...new Set(pakai.map((x) => x.kegiatanId))];
    // Kegiatan bersaldo yang belum dipakai tetap tampil untuk admin & akun
    // terikat kegiatan itu, selama tidak disaring per balai/status.
    const lintas = LINTAS_KEGIATAN.includes(user?.role);
    const saldoKosongTampil = !s.balaiId && !s.status && (lintas || !!user?.kegiatanId);
    const saldo = await this.prisma.saldoKegiatan.findMany({
      where: {
        tahun,
        ...(s.kegiatanId ? { kegiatanId: s.kegiatanId } : !lintas && user?.kegiatanId ? { kegiatanId: user.kegiatanId } : {}),
      },
    });
    const semua = [
      ...new Set([...kegiatanIds, ...saldo.filter((x) => saldoKosongTampil || kegiatanIds.includes(x.kegiatanId)).map((x) => x.kegiatanId)]),
    ].sort();
    const nama = new Map((await this.prisma.kegiatan.findMany({ where: { id: { in: semua } } })).map((k) => [k.id, k.name]));
    const kolom: Kolom[] = [
      { key: 'saldo', label: 'Saldo diberikan', jenis: 'rp' },
      { key: 'terpakai', label: 'Terpakai', jenis: 'rp' },
      { key: 'sisa', label: 'Sisa', jenis: 'rp' },
      { key: 'persen', label: '% terpakai', jenis: 'pct' },
    ];
    const baris: Baris[] = [];
    const total = { saldo: 0, terpakai: 0, sisa: 0, persen: null as number | null };
    let terpakaiBersaldo = 0; // sisa & % total hanya dari kegiatan yang punya saldo
    for (const id of semua) {
      const sd = saldo.find((x) => x.kegiatanId === id);
      const nilaiSaldo = sd ? Number(sd.total) : null;
      const milik = pakai.filter((x) => x.kegiatanId === id);
      const terpakai = milik.reduce((t, x) => t + Number(x.total ?? 0), 0);
      baris.push({
        label: `${id} · ${nama.get(id) ?? ''}`,
        nilai: {
          saldo: nilaiSaldo,
          terpakai,
          sisa: nilaiSaldo == null ? null : nilaiSaldo - terpakai,
          persen: nilaiSaldo ? (terpakai / nilaiSaldo) * 100 : null,
        },
      });
      for (const m of milik)
        baris.push({
          label: m.balai,
          rincian: true,
          nilai: {
            saldo: null,
            terpakai: Number(m.total ?? 0),
            sisa: null,
            persen: nilaiSaldo ? (Number(m.total ?? 0) / nilaiSaldo) * 100 : null,
          },
        });
      if (nilaiSaldo != null) {
        total.saldo += nilaiSaldo;
        terpakaiBersaldo += terpakai;
      }
      total.terpakai += terpakai;
    }
    total.sisa = total.saldo - terpakaiBersaldo;
    total.persen = total.saldo ? (terpakaiBersaldo / total.saldo) * 100 : null;
    return {
      judul: `Saldo & pemakaian per balai · ${tahun}`,
      kolom,
      baris,
      total: [{ label: 'Total', nilai: total }],
    };
  }
}
