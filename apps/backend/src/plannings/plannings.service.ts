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

const planningInclude = Prisma.validator<Prisma.PlanningInclude>()({
  balai: true,
  periode: true,
  wilayahSungai: true,
  createdBy: {
    select: {
      id: true,
      username: true,
      name: true,
      role: { select: { code: true, name: true } },
    },
  },
  kriteriaDokumen: true,
  majorProjects: { include: { majorProject: true } },
  tindakLanjut: { include: { tindakLanjut: true } },
  alokasi: {
    include: {
      ro: {
        include: {
          kro: { include: { kegiatan: { include: { program: true } } } },
        },
      },
      lokasi: true,
    },
    orderBy: [
      { tahun: Prisma.SortOrder.asc },
      { status: Prisma.SortOrder.asc },
    ],
  },
  prioritas: { orderBy: { tahun: Prisma.SortOrder.asc } },
  reviews: {
    include: { reviewer: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: Prisma.SortOrder.desc },
  },
});

@Injectable()
export class PlanningsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async create(dto: CreatePlanningDto, userId: string) {
    const planning = await this.prisma.planning.create({
      data: {
        balaiId: dto.balaiId,
        periodeId: dto.periodeId,
        projectName: dto.projectName,
        masaPelaksanaan: dto.masaPelaksanaan as any,
        kewenangan: (dto.kewenangan ?? 'PUSAT') as any,
        provinceId: dto.provinceId,
        cityId: dto.cityId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        wilayahSungaiId: dto.wilayahSungaiId,
        kebutuhanTanah: dto.kebutuhanTanah ?? false,
        sesuaiRTRW: dto.sesuaiRTRW,
        nomorPerdaRTRW: dto.nomorPerdaRTRW,
        sesuaiPolaSDA: dto.sesuaiPolaSDA,
        nomorKepmenPUPR: dto.nomorKepmenPUPR,
        sesuaiMasterplan: dto.sesuaiMasterplan,
        status: 'DRAFT',
        createdById: userId,

        kriteriaDokumen: dto.kriteriaDokumen
          ? {
              create: dto.kriteriaDokumen.map((k) => ({
                jenis: k.jenis,
                status: k.status as any,
                tahun: k.tahun,
              })),
            }
          : undefined,

        majorProjects: dto.majorProjects
          ? {
              create: dto.majorProjects.map((mp) => ({
                majorProjectId: mp.majorProjectId,
                detail: mp.detail,
              })),
            }
          : undefined,

        tindakLanjut: dto.tindakLanjutIds
          ? {
              create: dto.tindakLanjutIds.map((id) => ({ tindakLanjutId: id })),
            }
          : undefined,

        alokasi: dto.alokasi
          ? {
              create: dto.alokasi.map((a) => ({
                roId: a.roId,
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

        prioritas: dto.prioritas
          ? {
              create: dto.prioritas.map((p) => ({
                tahun: p.tahun,
                proyekPrioritas: p.proyekPrioritas ?? false,
                proyekRPIW: p.proyekRPIW ?? false,
                kegiatanBaru: p.kegiatanBaru ?? false,
                kegiatanWajib: p.kegiatanWajib ?? false,
                proyekKonregFKS: p.proyekKonregFKS ?? false,
                proyekMusrengbangnas: p.proyekMusrengbangnas ?? false,
              })),
            }
          : undefined,
      },
      include: planningInclude,
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

  async submit(id: string, user: any) {
    const planning = await this.prisma.planning.findUnique({ where: { id } });
    if (!planning) throw new NotFoundException('Planning tidak ditemukan');
    if (planning.createdById !== user.userId)
      throw new ForbiddenException('Bukan planning milik anda');
    if (planning.status !== 'DRAFT' && planning.status !== 'REVISION') {
      throw new BadRequestException(
        'Hanya planning berstatus DRAFT atau REVISION yang dapat disubmit',
      );
    }

    const updated = await this.prisma.planning.update({
      where: { id },
      data: { status: 'SUBMITTED' },
      include: planningInclude,
    });

    await this.invalidateCache(id);
    return updated;
  }

  async review(
    id: string,
    action: string,
    catatan: string | undefined,
    user: any,
  ) {
    const planning = await this.prisma.planning.findUnique({ where: { id } });
    if (!planning) throw new NotFoundException('Planning tidak ditemukan');
    if (planning.status !== 'SUBMITTED') {
      throw new BadRequestException(
        'Hanya planning berstatus SUBMITTED yang dapat direview',
      );
    }

    const statusMap: Record<string, string> = {
      approve: 'APPROVED',
      revision: 'REVISION',
      reject: 'REJECTED',
    };

    const status = statusMap[action];
    if (!status)
      throw new BadRequestException(
        'Action tidak valid. Gunakan: approve, revision, atau reject',
      );

    const updated = await this.prisma.planning.update({
      where: { id },
      data: {
        status: status as any,
        catatan,
        reviews: {
          create: { reviewerId: user.userId, action, catatan },
        },
      },
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
    if (planning.status !== 'DRAFT' && planning.status !== 'REVISION') {
      throw new BadRequestException(
        'Planning hanya dapat diedit saat berstatus DRAFT atau REVISION',
      );
    }

    const updated = await this.prisma.planning.update({
      where: { id },
      data: {
        projectName: dto.projectName,
        masaPelaksanaan: dto.masaPelaksanaan as any,
        kewenangan: dto.kewenangan as any,
        provinceId: dto.provinceId,
        cityId: dto.cityId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        wilayahSungaiId: dto.wilayahSungaiId,
        kebutuhanTanah: dto.kebutuhanTanah,
        sesuaiRTRW: dto.sesuaiRTRW,
        nomorPerdaRTRW: dto.nomorPerdaRTRW,
        sesuaiPolaSDA: dto.sesuaiPolaSDA,
        nomorKepmenPUPR: dto.nomorKepmenPUPR,
        sesuaiMasterplan: dto.sesuaiMasterplan,
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
    if (planning.status !== 'DRAFT') {
      throw new BadRequestException(
        'Hanya planning berstatus DRAFT yang dapat dihapus',
      );
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
