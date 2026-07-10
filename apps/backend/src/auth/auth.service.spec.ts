import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, MockPrisma } from '../../test/helpers/prisma-mock';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrisma;
  // JwtService cukup di-mock manual (bukan lewat jest-mock-extended) karena
  // yang kita pakai cuma satu method: signAsync().
  let jwtService: { signAsync: jest.Mock };

  // beforeEach jalan SEBELUM setiap `it(...)` di bawah — jadi tiap test
  // mulai dari kondisi yang bersih/segar, tidak kebawa state dari test lain.
  beforeEach(async () => {
    prisma = createPrismaMock();
    jwtService = { signAsync: jest.fn() };

    // Ini pola inti NestJS testing: kita bikin "module" versi test, lalu
    // bilang "kalau AuthService butuh PrismaService, kasih prisma palsu kita;
    // kalau butuh JwtService, kasih jwtService palsu kita" — bukan yang asli.
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('menolak login jika username tidak ditemukan di database', async () => {
      // Atur: kalau prisma.user.findUnique dipanggil, pura-pura hasilnya
      // "tidak ketemu" (null) — persis seperti username yang salah/tidak ada.
      prisma.user.findUnique.mockResolvedValue(null);

      // AuthService.login melempar UnauthorizedException kalau user null.
      // `rejects.toThrow(...)` = "pastikan promise ini REJECT dengan pesan ini".
      await expect(service.login('ghost', 'apapun123')).rejects.toThrow(
        'Username atau password salah',
      );
    });

    it('menolak login jika password salah', async () => {
      const hashAsli = await bcrypt.hash('password_benar', 10);

      prisma.user.findUnique.mockResolvedValue({
        id: 'user_1',
        username: 'admin',
        name: 'Admin',
        passwordHash: hashAsli,
        role: { id: 1, code: 'ADMINISTRATOR', name: 'Administrator' },
      } as any);

      await expect(
        service.login('admin', 'password_yang_salah'),
      ).rejects.toThrow('Username atau password salah');
    });

    it('login berhasil: mengembalikan accessToken & data user (tanpa passwordHash)', async () => {
      const hashAsli = await bcrypt.hash('password_benar', 10);

      prisma.user.findUnique.mockResolvedValue({
        id: 'user_1',
        username: 'admin',
        name: 'Admin Satu',
        passwordHash: hashAsli,
        role: { id: 1, code: 'ADMINISTRATOR', name: 'Administrator' },
      } as any);

      jwtService.signAsync.mockResolvedValue('token.jwt.palsu');

      const result = await service.login('admin', 'password_benar');

      expect(result.accessToken).toBe('token.jwt.palsu');
      expect(result.user).toEqual({
        id: 'user_1',
        username: 'admin',
        name: 'Admin Satu',
        role: 'ADMINISTRATOR',
      });
      // Pastikan passwordHash TIDAK ikut ke response — ini penting dari sisi
      // keamanan, jangan sampai hash password bocor ke client.
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('payload JWT berisi sub (id user), username, dan role code yang benar', async () => {
      const hashAsli = await bcrypt.hash('password_benar', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user_99',
        username: 'satker1',
        name: 'Satker Satu',
        passwordHash: hashAsli,
        role: { id: 2, code: 'SATKER', name: 'Satker' },
      } as any);
      jwtService.signAsync.mockResolvedValue('token.jwt.palsu');

      await service.login('satker1', 'password_benar');

      // Kita cek ARGUMEN yang dikirim ke jwtService.signAsync, bukan hasilnya.
      // Ini memastikan payload token benar-benar berisi data yang seharusnya.
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'user_99',
        username: 'satker1',
        role: 'SATKER',
      });
    });

    it('kasus tepi: user tanpa role (role null) tetap bisa login, payload role jadi undefined', async () => {
      // Ini bukan skenario yang biasa dicoba orang, tapi penting diuji:
      // di skema Prisma, roleId kemungkinan nullable. Kalau ada user lama
      // yang belum diberi role, aplikasi tidak boleh crash saat dia login.
      const hashAsli = await bcrypt.hash('password_benar', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user_5',
        username: 'user_tanpa_role',
        name: 'User Tanpa Role',
        passwordHash: hashAsli,
        role: null,
      } as any);
      jwtService.signAsync.mockResolvedValue('token.jwt.palsu');

      const result = await service.login('user_tanpa_role', 'password_benar');

      expect(result.user.role).toBeUndefined();
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ role: undefined }),
      );
    });

    it('memanggil prisma.user.findUnique dengan kondisi where username yang benar, sertakan relasi role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.login('admin', 'apapun123').catch(() => {});

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'admin' },
        include: { role: true },
      });
    });
  });
});
