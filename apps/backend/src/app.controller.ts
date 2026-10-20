import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getHello() {
    const users = await this.prisma.user.count();

    return {
      message: 'ePerencanaan backend running',
      totalUsers: users,
    };
  }

  /** Angka di halaman login (publik, hanya hitungan — tanpa data proyek). */
  @Get('statistik-login')
  async statistikLogin() {
    const periode = await this.prisma.periode.findFirst({ where: { isActive: true } });
    const [balai, proyek] = await Promise.all([
      this.prisma.balai.count({ where: { isActive: true } }),
      this.prisma.proyek.count({ where: periode ? { periodeId: periode.id } : {} }),
    ]);
    return { balai, proyek, periode: periode?.label ?? null };
  }
}
