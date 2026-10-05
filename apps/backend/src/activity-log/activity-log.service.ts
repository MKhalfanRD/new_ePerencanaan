import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  async findAll(q: {
    page: number;
    limit: number;
    userId?: string;
    roleCode?: string;
    search?: string;
    entity?: string;
    entityId?: string;
    dateFrom?: string;
    dateTo?: string;
    relatedProyekId?: string;
  }) {
    const and: Prisma.ActivityLogWhereInput[] = [];
    if (q.userId) and.push({ userId: q.userId });
    if (q.roleCode) and.push({ roleCode: q.roleCode });
    if (q.entity) and.push({ entity: q.entity });
    if (q.entityId) and.push({ entityId: q.entityId });
    if (q.dateFrom || q.dateTo) {
      and.push({
        createdAt: {
          ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}),
          ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}),
        },
      });
    }
    if (q.relatedProyekId) {
      // Widget "Riwayat Perubahan" di detail Proyek — selain mutasi Proyek
      // itu sendiri, Paket/Alokasi di bawahnya juga disimpan log-nya dengan
      // meta.proyekId (lihat activity-log.interceptor.ts), supaya histori
      // proyek tidak cuma menampilkan baris proyeknya saja.
      and.push({
        OR: [
          { entity: 'proyek', entityId: q.relatedProyekId },
          {
            entity: { in: ['paket', 'alokasi'] },
            meta: { path: ['proyekId'], equals: q.relatedProyekId },
          },
        ],
      });
    }
    if (q.search) {
      and.push({
        OR: [
          { username: { contains: q.search, mode: 'insensitive' } },
          { path: { contains: q.search, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.ActivityLogWhereInput = and.length ? { AND: and } : {};

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  }
}
