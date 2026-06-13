import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAlokasiDto,
  UpdateAlokasiDto,
  CreateLokasiDto,
} from './dto/create-alokasi.dto';

@Injectable()
export class AlokasiService {
  constructor(private prisma: PrismaService) {}

  private calcTotal(dto: any) {
    return (
      (dto.rm ?? 0) +
      (dto.rmp ?? 0) +
      (dto.pln ?? 0) +
      (dto.sbsn ?? 0) +
      (dto.kpbu ?? 0)
    );
  }

  async create(dto: CreateAlokasiDto) {
    const planning = await this.prisma.planning.findUnique({
      where: { id: dto.planningId },
    });
    if (!planning) throw new NotFoundException('Planning tidak ditemukan');
    if (planning.status !== 'DRAFT' && planning.status !== 'REVISION') {
      throw new BadRequestException(
        'Alokasi hanya bisa ditambah saat planning DRAFT atau REVISION',
      );
    }

    return this.prisma.alokasi.create({
      data: {
        planningId: dto.planningId,
        roId: dto.roId,
        tahun: dto.tahun,
        status: dto.status as any,
        rm: dto.rm ?? 0,
        rmp: dto.rmp ?? 0,
        pln: dto.pln ?? 0,
        sbsn: dto.sbsn ?? 0,
        kpbu: dto.kpbu ?? 0,
        total: this.calcTotal(dto),
        outputTarget: dto.outputTarget,
        outputUnit: dto.outputUnit,
        outcomeTarget: dto.outcomeTarget,
        outcomeUnit: dto.outcomeUnit,
        catatan: dto.catatan,
      },
      include: { ro: { include: { kro: true } }, lokasi: true },
    });
  }

  async update(id: string, dto: UpdateAlokasiDto, user: any) {
    const alokasi = await this.prisma.alokasi.findUnique({
      where: { id },
      include: { planning: true },
    });
    if (!alokasi) throw new NotFoundException('Alokasi tidak ditemukan');

    // Simpan histori sebelum update
    await this.prisma.historiAlokasi.create({
      data: {
        alokasiId: id,
        rm: alokasi.rm,
        rmp: alokasi.rmp,
        pln: alokasi.pln,
        sbsn: alokasi.sbsn,
        kpbu: alokasi.kpbu,
        total: alokasi.total,
        outputTarget: alokasi.outputTarget,
        outcomeTarget: alokasi.outcomeTarget,
        catatan: alokasi.catatan,
        changedBy: user.username,
      },
    });

    const newRm = dto.rm ?? Number(alokasi.rm);
    const newRmp = dto.rmp ?? Number(alokasi.rmp);
    const newPln = dto.pln ?? Number(alokasi.pln);
    const newSbsn = dto.sbsn ?? Number(alokasi.sbsn);
    const newKpbu = dto.kpbu ?? Number(alokasi.kpbu);

    return this.prisma.alokasi.update({
      where: { id },
      data: {
        rm: newRm,
        rmp: newRmp,
        pln: newPln,
        sbsn: newSbsn,
        kpbu: newKpbu,
        total: newRm + newRmp + newPln + newSbsn + newKpbu,
        outputTarget: dto.outputTarget,
        outputUnit: dto.outputUnit,
        outcomeTarget: dto.outcomeTarget,
        outcomeUnit: dto.outcomeUnit,
        catatan: dto.catatan,
      },
      include: { ro: true, lokasi: true, historiAlokasi: true },
    });
  }

  async remove(id: string) {
    const alokasi = await this.prisma.alokasi.findUnique({ where: { id } });
    if (!alokasi) throw new NotFoundException('Alokasi tidak ditemukan');
    await this.prisma.alokasi.delete({ where: { id } });
    return { message: 'Alokasi berhasil dihapus' };
  }

  async addLokasi(alokasiId: string, dto: CreateLokasiDto) {
    const alokasi = await this.prisma.alokasi.findUnique({
      where: { id: alokasiId },
    });
    if (!alokasi) throw new NotFoundException('Alokasi tidak ditemukan');
    return this.prisma.lokasiAlokasi.create({
      data: { alokasiId, ...dto },
    });
  }

  async removeLokasi(lokasiId: string) {
    await this.prisma.lokasiAlokasi.delete({ where: { id: lokasiId } });
    return { message: 'Lokasi berhasil dihapus' };
  }

  async getHistori(alokasiId: string) {
    return this.prisma.historiAlokasi.findMany({
      where: { alokasiId },
      orderBy: { changedAt: 'desc' },
    });
  }
}
