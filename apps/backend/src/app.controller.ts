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
}
