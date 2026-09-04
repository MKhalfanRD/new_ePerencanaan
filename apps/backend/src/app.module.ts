import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { PlanningsModule } from './plannings/plannings.module';
import { MasterModule } from './master/master.module';
import { AlokasiModule } from './alokasi/alokasi.module';
import { PaketModule } from './paket/paket.module';
import { ImportModule } from './import/import.module';
import { WilayahModule } from './wilayah/wilayah.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    AuthModule,
    UsersModule,
    PrismaModule,
    PlanningsModule,
    MasterModule,
    AlokasiModule,
    PaketModule,
    ImportModule,
    WilayahModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
