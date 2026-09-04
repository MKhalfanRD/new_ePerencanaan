import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreatePlanningDto } from './dto/create-planning.dto';
import { UpdatePlanningDto } from './dto/update-planning.dto';
import { QueryPlanningDto } from './dto/query-planning.dto';
import { generateKodeProyek } from '../common/kode-generator';

/** Lengkapi array alokasi nested-create dengan pasangan status (Rencana<->
 * Realisasi) bernilai 0 untuk tahun yang belum punya pasangannya — meniru
 * auto-pairing di AlokasiService.create() supaya tabel alokasi proyek baru
 * selalu lengkap Rencana+Realisasi sejak awal. */
function withPairedAlokasi<T extends { tahun: number; status: string }>(
  alokasi: T[],
): T[] {
  const result = [...alokasi];
  for (const a of alokasi) {
    const pairedStatus = a.status === 'RENCANA' ? 'REALISASI' : 'RENCANA';
    const hasPair = alokasi.some(
      (x) => x.tahun === a.tahun && x.status === pairedStatus,
    );
    if (!hasPair) {
      result.push({
        tahun: a.tahun,
        status: pairedStatus,
      } as T);
    }
  }
  return result;
}

const planningInclude = Prisma.validator<Prisma.PlanningInclude>()({
  balai: true,
  periode: true,
  createdBy: {
    select: {
      id: true,
      username: true,
      name: true,
      role: { select: { code: true, name: true } },
    },
  },
  paket: {
    where: { deletedAt: null },
    include: {
      ro: {
        include: {
          kro: { include: { kegiatan: { include: { program: true } } } },
        },
      },
      komponen: true,
      wilayahSungai: true,
      alokasi: {
        include: { lokasi: true },
        orderBy: [
          { tahun: Prisma.SortOrder.asc },
          { status: Prisma.SortOrder.asc },
        ],
      },
    },
    orderBy: { createdAt: Prisma.SortOrder.asc },
  },
});

@Injectable()
export class PlanningsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async create(dto: CreatePlanningDto, userId: string) {
    const planning = await this.prisma.$transaction(async (tx) => {
      // Kode Proyek & Kode Paket digenerate otomatis, tidak lagi diisi
      // manual — lihat src/common/kode-generator.ts.
      const kodeProyek = await generateKodeProyek(tx);
      const proyekPart = kodeProyek.slice(2);

      return tx.planning.create({
        data: {
        balaiId: dto.balaiId,
        periodeId: dto.periodeId,
        kodeProyek,
        projectName: dto.projectName,
        kewenangan: (dto.kewenangan ?? 'PUSAT') as any,
        provinceId: dto.provinceId,
        cityId: dto.cityId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        kebutuhanTanah: dto.kebutuhanTanah ?? false,
        sesuaiRTRW: dto.sesuaiRTRW,
        nomorPerdaRTRW: dto.nomorPerdaRTRW,
        sesuaiPolaSDA: dto.sesuaiPolaSDA,
        nomorKepmenPUPR: dto.nomorKepmenPUPR,
        sesuaiMasterplan: dto.sesuaiMasterplan,
        polaRencana: dto.polaRencana,
        tahunStudiLayak: dto.tahunStudiLayak,
        tahunDed: dto.tahunDed,
        tahunLarap: dto.tahunLarap,
        sumberUsulanProyek: dto.sumberUsulanProyek as any,
        sumberUsulanLainnya: dto.sumberUsulanLainnya,
        status: 'APPROVED',
        createdById: userId,

        paket: dto.paket
          ? {
              create: dto.paket.map((p, idx) => ({
                kodePaket: `PA${proyekPart}${String(idx + 1).padStart(4, '0')}`,
                name: p.name,
                roId: p.roId,
                komponenId: p.komponenId,
                jenis: p.jenis as any,
                masaPelaksanaan: p.masaPelaksanaan as any,
                wilayahSungaiId: p.wilayahSungaiId,
                dokLingStatus: p.dokLingStatus,
                catatanPembina: p.catatanPembina,
                catatanSspsda: p.catatanSspsda,
                kegiatanPrioritasId: p.kegiatanPrioritasId,
                pkpnId: p.pkpnId,
                indikatorSasaranProgramId: p.indikatorSasaranProgramId,
                indikatorSasaranKegiatanId: p.indikatorSasaranKegiatanId,
                indikatorRoId: p.indikatorRoId,
                tematikRenjaId: p.tematikRenjaId,
                fkb: p.fkb ?? false,
                fkw: p.fkw ?? false,
                mpa: p.mpa ?? false,

                alokasi: p.alokasi
                  ? {
                      // Sertakan pasangan Rencana/Realisasi bernilai 0 kalau
                      // belum ada — konsisten dengan AlokasiService.create(),
                      // supaya tabel alokasi selalu lengkap tanpa perlu
                      // "Tambah Alokasi" manual lagi setelah proyek dibuat.
                      create: withPairedAlokasi(p.alokasi).map((a) => ({
                        tahun: a.tahun,
                        status: a.status as any,
                        rm: a.rm ?? 0,
                        rmp: a.rmp ?? 0,
                        pln: a.pln ?? 0,
                        sbsn: a.sbsn ?? 0,
                        kpbu: a.kpbu ?? 0,
                        total:
                          (a.rm ?? 0) +
                          (a.rmp ?? 0) +
                          (a.pln ?? 0) +
                          (a.sbsn ?? 0) +
                          (a.kpbu ?? 0),
                        outputTarget: a.outputTarget,
                        outputUnit: a.outputUnit,
                        outcomeTarget: a.outcomeTarget,
                        outcomeUnit: a.outcomeUnit,
                        catatan: a.catatan,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
      },
        include: planningInclude,
      });
    });

    await this.redis.delByPrefix('plannings:list:');
    return planning;
  }

  async findAll(user: any, query: QueryPlanningDto) {
    const { status, page = 1, limit = 10, search, periodeId } = query;
    const skip = (page - 1) * limit;

    const cacheKey = `plannings:list:${user.userId}:${user.role}:${status ?? ''}:${page}:${limit}:${search ?? ''}:${periodeId ?? ''}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const where: Prisma.PlanningWhereInput = {};

    if (user.role !== 'ADMINISTRATOR' && user.role !== 'VERIFICATOR') {
      where.createdById = user.userId;
    }
    if (status) where.status = status as any;
    if (periodeId) where.periodeId = Number(periodeId);
    if (search) where.projectName = { contains: search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.planning.findMany({
        where,
        include: planningInclude,
        orderBy: { createdAt: Prisma.SortOrder.desc },
        skip,
        take: limit,
      }),
      this.prisma.planning.count({ where }),
    ]);

    const result = {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };

    await this.redis.setWithPrefix('plannings:list:', cacheKey, result, 60);
    return result;
  }

  async findOne(id: string, user: any) {
    const cacheKey = `planning:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const planning = await this.prisma.planning.findUnique({
      where: { id },
      include: planningInclude,
    });

    if (!planning) throw new NotFoundException('Planning tidak ditemukan');

    if (
      user.role !== 'ADMINISTRATOR' &&
      user.role !== 'VERIFICATOR' &&
      planning.createdById !== user.userId
    ) {
      throw new ForbiddenException('Anda tidak memiliki akses ke planning ini');
    }

    await this.redis.set(cacheKey, planning, 300);
    return planning;
  }

  /** Status planning cuma DRAFT & APPROVED — tidak ada alur submit/review lagi. */
  async approve(id: string) {
    const planning = await this.prisma.planning.findUnique({ where: { id } });
    if (!planning) throw new NotFoundException('Planning tidak ditemukan');
    if (planning.status !== 'DRAFT') {
      throw new BadRequestException(
        'Hanya planning berstatus DRAFT yang dapat disetujui',
      );
    }

    const updated = await this.prisma.planning.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: planningInclude,
    });

    await this.invalidateCache(id);
    return updated;
  }

  /** Kembalikan planning yang APPROVED ke DRAFT (mis. salah setuju / perlu revisi lagi). */
  async unapprove(id: string) {
    const planning = await this.prisma.planning.findUnique({ where: { id } });
    if (!planning) throw new NotFoundException('Planning tidak ditemukan');
    if (planning.status !== 'APPROVED') {
      throw new BadRequestException(
        'Hanya planning berstatus APPROVED yang dapat dikembalikan ke draft',
      );
    }

    const updated = await this.prisma.planning.update({
      where: { id },
      data: { status: 'DRAFT' },
      include: planningInclude,
    });

    await this.invalidateCache(id);
    return updated;
  }

  async update(id: string, dto: UpdatePlanningDto, user: any) {
    const planning = await this.prisma.planning.findUnique({ where: { id } });
    if (!planning) throw new NotFoundException('Planning tidak ditemukan');
    if (user.role !== 'ADMINISTRATOR' && planning.createdById !== user.userId)
      throw new ForbiddenException('Bukan planning milik anda');

    const updated = await this.prisma.planning.update({
      where: { id },
      data: {
        // kodeProyek sengaja tidak diikutkan — permanen sejak dibuat.
        balaiId: dto.balaiId,
        periodeId: dto.periodeId,
        projectName: dto.projectName,
        kewenangan: dto.kewenangan as any,
        provinceId: dto.provinceId,
        cityId: dto.cityId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        kebutuhanTanah: dto.kebutuhanTanah,
        sesuaiRTRW: dto.sesuaiRTRW,
        nomorPerdaRTRW: dto.nomorPerdaRTRW,
        sesuaiPolaSDA: dto.sesuaiPolaSDA,
        nomorKepmenPUPR: dto.nomorKepmenPUPR,
        sesuaiMasterplan: dto.sesuaiMasterplan,
        polaRencana: dto.polaRencana,
        tahunStudiLayak: dto.tahunStudiLayak,
        tahunDed: dto.tahunDed,
        tahunLarap: dto.tahunLarap,
        sumberUsulanProyek: dto.sumberUsulanProyek as any,
        sumberUsulanLainnya: dto.sumberUsulanLainnya,
      },
      include: planningInclude,
    });

    await this.invalidateCache(id);
    return updated;
  }

  async remove(id: string, user: any) {
    const planning = await this.prisma.planning.findUnique({ where: { id } });
    if (!planning) throw new NotFoundException('Planning tidak ditemukan');
    if (user.role !== 'ADMINISTRATOR' && planning.createdById !== user.userId) {
      throw new ForbiddenException('Bukan planning milik anda');
    }

    await this.prisma.planning.delete({ where: { id } });
    await this.invalidateCache(id);
    return { message: 'Planning berhasil dihapus' };
  }

  private async invalidateCache(id: string) {
    await this.redis.del(`planning:${id}`);
    await this.redis.delByPrefix('plannings:list:');
  }
}
