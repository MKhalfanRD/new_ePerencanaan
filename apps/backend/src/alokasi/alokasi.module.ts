import { Module } from '@nestjs/common';
import { AlokasiController } from './alokasi.controller';
import { AlokasiService } from './alokasi.service';

@Module({
  controllers: [AlokasiController],
  providers: [AlokasiService],
})
export class AlokasiModule {}
