import { Injectable, UnauthorizedException } from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        username,
      },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Username atau password salah');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Username atau password salah');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role?.code,
      // Cakupan kegiatan role (mis. "7691"). Ikut di token supaya filter
      // proyek per kegiatan tidak perlu query role tiap request.
      kegiatanId: user.role?.kegiatanId ?? null,
      // Template izin role turunan — lihat src/auth/role.ts.
      baseRole: user.role?.baseRole ?? null,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),

      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role?.code,
        kegiatanId: user.role?.kegiatanId ?? null,
        baseRole: user.role?.baseRole ?? null,
      },
    };
  }
}
