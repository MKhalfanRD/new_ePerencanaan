import { Module } from '@nestjs/common';
import { SaldoKegiatanController } from './saldo-kegiatan.controller';
import { SaldoKegiatanService } from './saldo-kegiatan.service';

@Module({
  controllers: [SaldoKegiatanController],
  providers: [SaldoKegiatanService],
})
export class SaldoKegiatanModule {}
