import { Test } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { ProyekService } from './proyek.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { createPrismaMock, MockPrisma } from '../../test/helpers/prisma-mock';
import { createRedisMock, MockRedis } from '../../test/helpers/redis-mock';

// Helper kecil bikin objek proyek contoh, supaya tiap test tidak perlu
// nulis ulang semua field. `overrides` dipakai kalau satu test butuh
// nilai yang beda (mis. status APPROVED, atau createdById lain).
const buildProyek = (overrides: Partial<any> = {}) => ({
  id: 'proyek_1',
  status: 'DRAFT',
  createdById: 'user_1',
  projectName: 'Pembangunan Sumur Air Tanah',
  ...overrides,
});

describe('ProyekService', () => {
  let service: ProyekService;
  let prisma: MockPrisma;
  let redis: MockRedis;

  const satkerUser = { userId: 'user_1', role: 'SATKER' };
  const otherSatkerUser = { userId: 'user_2', role: 'SATKER' };
  const adminUser = { userId: 'admin_1', role: 'ADMINISTRATOR' };
  const verificatorUser = { userId: 'verif_1', role: 'VERIFICATOR' };

  beforeEach(async () => {
    prisma = createPrismaMock();
    redis = createRedisMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProyekService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = moduleRef.get(ProyekService);
  });

  describe('create', () => {
    it('status proyek baru selalu DRAFT, walau field lain dikirim', async () => {
      prisma.proyek.create.mockResolvedValue(buildProyek() as any);

      await service.create(
        { balaiId: 1, periodeId: 1, projectName: 'Proyek A' } as any,
        'user_1',
      );

      const callArg = prisma.proyek.create.mock.calls[0][0];
      expect(callArg.data.status).toBe('DRAFT');
      expect(callArg.data.createdById).toBe('user_1');
    });

    it('total alokasi dihitung otomatis dari rm+rmp+pln+sbsn+kpbu (field kosong dianggap 0)', async () => {
      prisma.proyek.create.mockResolvedValue(buildProyek() as any);
      prisma.balai.findUnique.mockResolvedValue({ isActive: true } as any);

      await service.create(
        {
          balaiId: 1,
          periodeId: 1,
          projectName: 'Proyek A',
          paket: [
            {
              name: 'Paket I',
              roId: 'ro_1',
              jenis: 'FISIK',
              masaPelaksanaan: 'SINGLE_YEAR',
              alokasi: [{ tahun: 2025, status: 'RENCANA', rm: 1000, rmp: 500 }],
            },
            {
              name: 'Paket II',
              roId: 'ro_2',
              jenis: 'FISIK',
              masaPelaksanaan: 'SINGLE_YEAR',
              // sengaja tidak isi rm/rmp sama sekali
              alokasi: [{ tahun: 2025, status: 'RENCANA', pln: 200 }],
            },
          ],
        } as any,
        'user_1',
      );

      const callArg = prisma.proyek.create.mock.calls[0][0];
      const paketCreated = callArg.data.paket.create;
      expect(paketCreated[0].alokasi.create[0].total).toBe(1500); // 1000 + 500
      expect(paketCreated[1].alokasi.create[0].total).toBe(200); // hanya pln, sisanya 0
    });

    it('setelah create, cache list "proyek:list:" di-invalidasi', async () => {
      prisma.proyek.create.mockResolvedValue(buildProyek() as any);

      await service.create(
        { balaiId: 1, periodeId: 1, projectName: 'Proyek A' } as any,
        'user_1',
      );

      expect(redis.delByPrefix).toHaveBeenCalledWith('proyek:list:');
    });
  });

  describe('findAll', () => {
    it('role SATKER: otomatis difilter hanya proyek miliknya sendiri', async () => {
      prisma.proyek.findMany.mockResolvedValue([]);
      prisma.proyek.count.mockResolvedValue(0);

      await service.findAll(satkerUser, {} as any);

      const whereArg = prisma.proyek.findMany.mock.calls[0][0].where;
      expect(whereArg.createdById).toBe('user_1');
    });

    it('role ADMINISTRATOR: TIDAK difilter per-user (bisa lihat semua proyek)', async () => {
      prisma.proyek.findMany.mockResolvedValue([]);
      prisma.proyek.count.mockResolvedValue(0);

      await service.findAll(adminUser, {} as any);

      const whereArg = prisma.proyek.findMany.mock.calls[0][0].where;
      expect(whereArg.createdById).toBeUndefined();
    });

    it('role VERIFICATOR: TIDAK difilter per-user juga', async () => {
      prisma.proyek.findMany.mockResolvedValue([]);
      prisma.proyek.count.mockResolvedValue(0);

      await service.findAll(verificatorUser, {} as any);

      const whereArg = prisma.proyek.findMany.mock.calls[0][0].where;
      expect(whereArg.createdById).toBeUndefined();
    });

    it('pagination: skip & take dihitung benar dari page & limit', async () => {
      prisma.proyek.findMany.mockResolvedValue([]);
      prisma.proyek.count.mockResolvedValue(25);

      const result = await service.findAll(adminUser, {
        page: 3,
        limit: 10,
      } as any);

      const callArg = prisma.proyek.findMany.mock.calls[0][0];
      expect(callArg.skip).toBe(20); // (page-1) * limit = (3-1)*10
      expect(callArg.take).toBe(10);
      expect(result.meta.totalPages).toBe(3); // ceil(25/10)
    });

    it('cache HIT: langsung return dari Redis, tidak query Prisma sama sekali', async () => {
      const cachedResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      redis.get.mockResolvedValue(cachedResult as any);

      const result = await service.findAll(adminUser, {} as any);

      expect(result).toBe(cachedResult);
      expect(prisma.proyek.findMany).not.toHaveBeenCalled();
    });

    it('filter search: pakai "contains" case-insensitive pada projectName', async () => {
      prisma.proyek.findMany.mockResolvedValue([]);
      prisma.proyek.count.mockResolvedValue(0);

      await service.findAll(adminUser, { search: 'sumur' } as any);

      const whereArg = prisma.proyek.findMany.mock.calls[0][0].where;
      expect(whereArg.projectName).toEqual({
        contains: 'sumur',
        mode: 'insensitive',
      });
    });
  });

  describe('findOne', () => {
    it('proyek tidak ditemukan → NotFoundException', async () => {
      prisma.proyek.findUnique.mockResolvedValue(null);

      await expect(service.findOne('id_ga_ada', satkerUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('bukan pemilik & bukan admin/verificator → ForbiddenException', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ createdById: 'user_1' }) as any,
      );

      await expect(
        service.findOne('proyek_1', otherSatkerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('pemilik sendiri → boleh akses', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ createdById: 'user_1' }) as any,
      );

      const result = await service.findOne('proyek_1', satkerUser);
      expect(result.id).toBe('proyek_1');
    });

    it('ADMINISTRATOR boleh akses proyek siapa saja', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ createdById: 'user_lain' }) as any,
      );

      const result = await service.findOne('proyek_1', adminUser);
      expect(result.id).toBe('proyek_1');
    });

    it('cache HIT: langsung return dari Redis, tidak query Prisma', async () => {
      const cachedProyek = buildProyek();
      redis.get.mockResolvedValue(cachedProyek as any);

      const result = await service.findOne('proyek_1', satkerUser);

      expect(result).toBe(cachedProyek);
      expect(prisma.proyek.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('status DRAFT → sukses jadi APPROVED', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ status: 'DRAFT' }) as any,
      );
      prisma.proyek.update.mockResolvedValue(
        buildProyek({ status: 'APPROVED' }) as any,
      );

      const result = await service.approve('proyek_1');
      expect(result.status).toBe('APPROVED');
    });

    it('status selain DRAFT → BadRequestException', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ status: 'APPROVED' }) as any,
      );

      await expect(service.approve('proyek_1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('setelah approve, cache di-invalidasi (detail & list)', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ status: 'DRAFT' }) as any,
      );
      prisma.proyek.update.mockResolvedValue(
        buildProyek({ status: 'APPROVED' }) as any,
      );

      await service.approve('proyek_1');

      expect(redis.del).toHaveBeenCalledWith('proyek:proyek_1');
      expect(redis.delByPrefix).toHaveBeenCalledWith('proyek:list:');
    });
  });

  describe('unapprove', () => {
    it('status APPROVED → sukses jadi DRAFT', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ status: 'APPROVED' }) as any,
      );
      prisma.proyek.update.mockResolvedValue(
        buildProyek({ status: 'DRAFT' }) as any,
      );

      const result = await service.unapprove('proyek_1');
      expect(result.status).toBe('DRAFT');
    });

    it('status selain APPROVED → BadRequestException', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ status: 'DRAFT' }) as any,
      );

      await expect(service.unapprove('proyek_1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    // ==========================================================
    // TEST REGRESI — bug asli di kode:
    //   if (proyek.createdById !== 'ADMINISTRATOR' && ...)
    // `createdById` adalah cuid, TIDAK PERNAH sama dengan string
    // 'ADMINISTRATOR', jadi kondisi itu selalu true dan syarat efektifnya
    // cuma `createdById !== user.userId` — akibatnya user ADMINISTRATOR
    // tidak bisa override edit proyek milik orang lain. Sudah diperbaiki
    // jadi `user.role !== 'ADMINISTRATOR'` (konsisten dengan remove()).
    // ==========================================================
    it('[REGRESI] ADMINISTRATOR BISA mengedit proyek milik user lain', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ createdById: 'user_lain', status: 'DRAFT' }) as any,
      );
      prisma.proyek.update.mockResolvedValue(
        buildProyek({
          createdById: 'user_lain',
          projectName: 'Sudah Diedit Admin',
        }) as any,
      );

      const result = await service.update(
        'proyek_1',
        { projectName: 'Sudah Diedit Admin' } as any,
        adminUser,
      );

      expect(result.projectName).toBe('Sudah Diedit Admin');
    });

    it('SATKER HANYA bisa edit proyek miliknya sendiri', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ createdById: 'user_1', status: 'DRAFT' }) as any,
      );
      prisma.proyek.update.mockResolvedValue(buildProyek() as any);

      await expect(
        service.update(
          'proyek_1',
          { projectName: 'Coba Edit' } as any,
          otherSatkerUser, // user_2 mencoba edit proyek milik user_1
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SATKER pemilik sendiri tetap bisa edit proyek-nya', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ createdById: 'user_1', status: 'DRAFT' }) as any,
      );
      prisma.proyek.update.mockResolvedValue(
        buildProyek({ projectName: 'Sudah Diedit' }) as any,
      );

      const result = await service.update(
        'proyek_1',
        { projectName: 'Sudah Diedit' } as any,
        satkerUser,
      );
      expect(result.projectName).toBe('Sudah Diedit');
    });

    it('status bukan DRAFT (mis. APPROVED) → BadRequestException', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ createdById: 'user_1', status: 'APPROVED' }) as any,
      );

      await expect(
        service.update(
          'proyek_1',
          { projectName: 'Coba Edit' } as any,
          satkerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('proyek tidak ditemukan → NotFoundException', async () => {
      prisma.proyek.findUnique.mockResolvedValue(null);

      await expect(
        service.update('id_ga_ada', { projectName: 'X' } as any, satkerUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('hanya status DRAFT yang bisa dihapus', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ createdById: 'user_1', status: 'APPROVED' }) as any,
      );

      await expect(service.remove('proyek_1', satkerUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ADMINISTRATOR boleh hapus proyek milik siapa pun (selama DRAFT)', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ createdById: 'user_lain', status: 'DRAFT' }) as any,
      );
      prisma.proyek.delete.mockResolvedValue(buildProyek() as any);

      const result = await service.remove('proyek_1', adminUser);
      expect(result.message).toBe('Proyek berhasil dihapus');
    });

    it('role selain admin hanya boleh hapus proyek miliknya sendiri', async () => {
      prisma.proyek.findUnique.mockResolvedValue(
        buildProyek({ createdById: 'user_1', status: 'DRAFT' }) as any,
      );

      await expect(service.remove('proyek_1', otherSatkerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('proyek tidak ditemukan → NotFoundException', async () => {
      prisma.proyek.findUnique.mockResolvedValue(null);

      await expect(service.remove('id_ga_ada', satkerUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
