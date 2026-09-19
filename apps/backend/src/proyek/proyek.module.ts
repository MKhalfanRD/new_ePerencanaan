import { Module } from '@nestjs/common';
import { ProyekController } from './proyek.controller';
import { ProyekService } from './proyek.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [ProyekController],
  providers: [ProyekService],
})
export class ProyekModule {}
