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
import { ActivityLogModule } from './activity-log/activity-log.module';
import { ActivityLogInterceptor } from './activity-log/activity-log.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

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
    ActivityLogModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Catat semua mutasi (POST/PATCH/PUT/DELETE) ke activity_logs.
    { provide: APP_INTERCEPTOR, useClass: ActivityLogInterceptor },
  ],
})
export class AppModule {}
