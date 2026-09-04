import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  CreateAlokasiDto,
  UpdateAlokasiDto,
  CreateLokasiDto,
} from './dto/create-alokasi.dto';

@Injectable()
export class AlokasiService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  private calcTotal(dto: any) {
    return (
      (dto.rm ?? 0) +
      (dto.rmp ?? 0) +
      (dto.pln ?? 0) +
      (dto.sbsn ?? 0) +
      (dto.kpbu ?? 0)
    );
  }

  // Planning list/detail di-cache di Redis (plannings.service.ts). Semua
  // mutasi di sini menembus paket->planning, tapi service ini sebelumnya
  // TIDAK PERNAH invalidasi cache itu — jadi setelah tambah/edit alokasi
  // atau lokasi, popup sukses muncul & DB benar berubah, tapi tabel/detail
  // proyek masih menampilkan data lama sampai TTL cache habis (60 detik
  // untuk list, 300 detik untuk detail). Ini akar dari beberapa keluhan
  // yang kelihatannya beda-beda: "alokasi baru tidak muncul", "nilai yang
  // sudah diedit tidak berubah", "harus tunggu beberapa detik".
  private async invalidatePlanning(planningId: string) {
    await this.redis.del(`planning:${planningId}`);
    await this.redis.delByPrefix('plannings:list:');
  }

  async create(dto: CreateAlokasiDto) {
    const paket = await this.prisma.paket.findUnique({
      where: { id: dto.paketId },
      include: { planning: true },
    });
    if (!paket) throw new NotFoundException('Paket tidak ditemukan');

    const duplicate = await this.prisma.alokasi.findUnique({
      where: {
        paketId_tahun_status: {
          paketId: dto.paketId,
          tahun: dto.tahun,
          status: dto.status as any,
        },
      },
    });
    if (duplicate) {
      const statusLabel = dto.status === 'RENCANA' ? 'Rencana' : 'Realisasi';
      throw new BadRequestException(
        `Alokasi ${statusLabel} untuk tahun ${dto.tahun} sudah ada di paket ini — silakan edit yang sudah ada, bukan tambah baru.`,
      );
    }

    const pairedStatus = dto.status === 'RENCANA' ? 'REALISASI' : 'RENCANA';

    // Cek apakah pasangannya (status sebaliknya) sudah ada untuk tahun yang sama
    const existingPair = await this.prisma.alokasi.findUnique({
      where: {
        paketId_tahun_status: {
          paketId: dto.paketId,
          tahun: dto.tahun,
          status: pairedStatus as any,
        },
      },
    });

    const created = await this.prisma.alokasi.create({
      data: {
        paketId: dto.paketId,
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
      include: { paket: { include: { ro: { include: { kro: true } } } }, lokasi: true },
    });

    // Auto-buat pasangan dengan nilai 0 kalau belum ada, supaya tabel selalu lengkap Rencana+Realisasi
    if (!existingPair) {
      await this.prisma.alokasi.create({
        data: {
          paketId: dto.paketId,
          tahun: dto.tahun,
          status: pairedStatus as any,
          rm: 0,
          rmp: 0,
          pln: 0,
          sbsn: 0,
          kpbu: 0,
          total: 0,
          outputUnit: dto.outputUnit,
          outcomeUnit: dto.outcomeUnit,
          catatan: 'Dibuat otomatis sebagai pasangan',
        },
      });
    }

    await this.invalidatePlanning(paket.planningId);
    return created;
  }

  async findOne(id: string) {
    const alokasi = await this.prisma.alokasi.findUnique({
      where: { id },
      include: {
        paket: {
          include: {
            planning: { select: { id: true, projectName: true } },
            ro: {
              include: {
                indikatorRO: true,
                kro: { include: { kegiatan: { include: { program: true } } } },
              },
            },
            komponen: true,
          },
        },
        lokasi: { orderBy: { createdAt: 'desc' } },
        historiAlokasi: { orderBy: { changedAt: 'desc' } },
      },
    });
    if (!alokasi) throw new NotFoundException('Alokasi tidak ditemukan');
    return alokasi;
  }

  async update(id: string, dto: UpdateAlokasiDto, user: any) {
    const alokasi = await this.prisma.alokasi.findUnique({
      where: { id },
      include: { paket: { select: { planningId: true } } },
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

    const updated = await this.prisma.alokasi.update({
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
      include: {
        paket: {
          include: {
            ro: {
              include: {
                kro: { include: { kegiatan: { include: { program: true } } } },
              },
            },
          },
        },
        lokasi: true,
        historiAlokasi: { orderBy: { changedAt: 'desc' } },
      },
    });

    await this.invalidatePlanning(alokasi.paket.planningId);
    return updated;
  }

  async remove(id: string) {
    const alokasi = await this.prisma.alokasi.findUnique({
      where: { id },
      include: { paket: { select: { planningId: true } } },
    });
    if (!alokasi) throw new NotFoundException('Alokasi tidak ditemukan');
    await this.prisma.alokasi.delete({ where: { id } });
    await this.invalidatePlanning(alokasi.paket.planningId);
    return { message: 'Alokasi berhasil dihapus' };
  }

  async addLokasi(alokasiId: string, dto: CreateLokasiDto) {
    const alokasi = await this.prisma.alokasi.findUnique({
      where: { id: alokasiId },
      include: { paket: { select: { planningId: true } } },
    });
    if (!alokasi) throw new NotFoundException('Alokasi tidak ditemukan');

    const created = await this.prisma.lokasiAlokasi.create({
      data: {
        alokasiId,
        name: dto.name,
        tipeKoordinat: dto.tipeKoordinat as any,
        provinceId: dto.provinceId,
        provinceName: dto.provinceName,
        cityId: dto.cityId,
        cityName: dto.cityName,
        districtId: dto.districtId,
        districtName: dto.districtName,
        villageId: dto.villageId,
        villageName: dto.villageName,
        latitude: dto.latitude,
        longitude: dto.longitude,
        // `coordinates` sudah bertipe Json di schema — Prisma yang
        // menyimpan array-nya langsung, JANGAN di-JSON.stringify manual di
        // sini (dulu begitu, hasilnya array tersimpan sebagai STRING berisi
        // teks JSON, lalu waktu di-edit-lalu-simpan-ulang jadi ter-encode
        // dua kali/rusak).
        coordinates: dto.coordinates ?? undefined,
      },
    });

    await this.invalidatePlanning(alokasi.paket.planningId);
    return created;
  }

  async updateLokasi(lokasiId: string, dto: CreateLokasiDto) {
    const lokasi = await this.prisma.lokasiAlokasi.findUnique({
      where: { id: lokasiId },
      include: { alokasi: { include: { paket: { select: { planningId: true } } } } },
    });
    if (!lokasi) throw new NotFoundException('Lokasi tidak ditemukan');

    const updated = await this.prisma.lokasiAlokasi.update({
      where: { id: lokasiId },
      data: {
        name: dto.name,
        tipeKoordinat: dto.tipeKoordinat as any,
        provinceId: dto.provinceId,
        provinceName: dto.provinceName,
        cityId: dto.cityId,
        cityName: dto.cityName,
        districtId: dto.districtId,
        districtName: dto.districtName,
        villageId: dto.villageId,
        villageName: dto.villageName,
        latitude: dto.latitude,
        longitude: dto.longitude,
        // `coordinates` sudah bertipe Json di schema — Prisma yang
        // menyimpan array-nya langsung, JANGAN di-JSON.stringify manual di
        // sini (dulu begitu, hasilnya array tersimpan sebagai STRING berisi
        // teks JSON, lalu waktu di-edit-lalu-simpan-ulang jadi ter-encode
        // dua kali/rusak).
        coordinates: dto.coordinates ?? undefined,
      },
    });

    await this.invalidatePlanning(lokasi.alokasi.paket.planningId);
    return updated;
  }

  async removeLokasi(lokasiId: string) {
    const lokasi = await this.prisma.lokasiAlokasi.findUnique({
      where: { id: lokasiId },
      include: { alokasi: { include: { paket: { select: { planningId: true } } } } },
    });
    if (!lokasi) throw new NotFoundException('Lokasi tidak ditemukan');
    await this.prisma.lokasiAlokasi.delete({ where: { id: lokasiId } });
    await this.invalidatePlanning(lokasi.alokasi.paket.planningId);
    return { message: 'Lokasi berhasil dihapus' };
  }

  async getHistori(alokasiId: string) {
    return this.prisma.historiAlokasi.findMany({
      where: { alokasiId },
      orderBy: { changedAt: 'desc' },
    });
  }
}
