import { Module } from '@nestjs/common';
import { PaketController } from './paket.controller';
import { PaketService } from './paket.service';

@Module({
  controllers: [PaketController],
  providers: [PaketService],
})
export class PaketModule {}
