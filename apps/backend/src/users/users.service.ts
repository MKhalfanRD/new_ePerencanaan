import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, SetUserStatusDto } from './dto/update-user.dto';

const userSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  nip: true,
  phone: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: { code: true, name: true },
  },
  balai: {
    select: { id: true, name: true, kegiatanId: true },
  },
  satker: {
    select: { id: true, kode: true, name: true },
  },
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: userSelect,
      // Urut balai (kode) lalu satker (kode); akun pusat tanpa balai di akhir.
      orderBy: [
        { balaiId: { sort: 'asc', nulls: 'last' } },
        { satker: { kode: 'asc' } },
        { username: 'asc' },
      ],
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return user;
  }

  /** Satker harus milik balai akun; tanpa balai = tanpa satker (akun pusat). */
  private async unitAkun(balaiId: number | null | undefined, satkerId: string | null | undefined) {
    if (!balaiId) return { balaiId: null, satkerId: null };
    if (!satkerId) return { balaiId, satkerId: null };
    const s = await this.prisma.satker.findUnique({ where: { id: satkerId } });
    if (!s || s.balaiId !== balaiId)
      throw new BadRequestException('Satker tidak termasuk balai yang dipilih');
    return { balaiId, satkerId };
  }

  async create(dto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existingUser) {
      throw new BadRequestException('Username sudah digunakan');
    }

    const role = await this.prisma.role.findUnique({
      where: { code: dto.roleCode },
    });

    if (!role) {
      throw new BadRequestException('Role tidak ditemukan');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash: hashedPassword,
        name: dto.name,
        email: dto.email,
        nip: dto.nip,
        phone: dto.phone,
        ...(await this.unitAkun(dto.balaiId, dto.satkerId)),
        roleId: role.id,
      },
      select: userSelect,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const data: any = {
      name: dto.name ?? user.name,
      email: dto.email ?? user.email,
      nip: dto.nip ?? user.nip,
      phone: dto.phone ?? user.phone,
      // null dari form = dikosongkan (akun pusat / tanpa satker).
      ...(await this.unitAkun(
        dto.balaiId !== undefined ? dto.balaiId : user.balaiId,
        dto.satkerId !== undefined ? dto.satkerId : user.satkerId,
      )),
    };

    if (dto.roleCode) {
      const role = await this.prisma.role.findUnique({
        where: { code: dto.roleCode },
      });
      if (!role) {
        throw new BadRequestException('Role tidak ditemukan');
      }
      data.roleId = role.id;
    }

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  }

  async setStatus(id: string, dto: SetUserStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: userSelect,
    });
  }

  async remove(id: string, requesterId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (user.id === requesterId) {
      throw new BadRequestException('Tidak dapat menghapus akun sendiri');
    }

    await this.prisma.user.delete({ where: { id } });

    return { message: 'User berhasil dihapus' };
  }

  async bulkRemove(ids: string[], requesterId: string) {
    if (ids.includes(requesterId)) {
      throw new BadRequestException('Tidak dapat menghapus akun sendiri');
    }
    const result = await this.prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
    return {
      message: `${result.count} user berhasil dihapus`,
      count: result.count,
    };
  }
}
