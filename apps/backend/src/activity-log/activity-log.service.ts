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
  }) {
    const where: Prisma.ActivityLogWhereInput = {};
    if (q.userId) where.userId = q.userId;
    if (q.roleCode) where.roleCode = q.roleCode;
    if (q.search) {
      where.OR = [
        { username: { contains: q.search, mode: 'insensitive' } },
        { path: { contains: q.search, mode: 'insensitive' } },
      ];
    }

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
