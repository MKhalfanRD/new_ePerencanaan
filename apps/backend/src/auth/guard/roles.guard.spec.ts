import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';
import { createExecutionContextMock } from '../../../test/helpers/execution-context-mock';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [RolesGuard, { provide: Reflector, useValue: reflector }],
    }).compile();

    guard = moduleRef.get(RolesGuard);
  });

  it('endpoint TANPA @Roles(): siapa saja boleh akses (return true)', () => {
    // getAllAndOverride mengembalikan undefined kalau handler tidak
    // di-decorate @Roles(...) sama sekali.
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = createExecutionContextMock({ role: 'SATKER' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('endpoint dengan @Roles("ADMINISTRATOR"): user role SATKER ditolak', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMINISTRATOR']);

    const context = createExecutionContextMock({ role: 'SATKER' });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('endpoint dengan @Roles("ADMINISTRATOR"): user role ADMINISTRATOR diterima', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMINISTRATOR']);

    const context = createExecutionContextMock({ role: 'ADMINISTRATOR' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('endpoint dengan multi-role @Roles("ADMINISTRATOR","VERIFICATOR"): user salah satunya diterima', () => {
    reflector.getAllAndOverride.mockReturnValue([
      'ADMINISTRATOR',
      'VERIFICATOR',
    ]);

    const context = createExecutionContextMock({ role: 'VERIFICATOR' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('kasus tepi: request.user undefined (mis. guard urutan salah) tidak boleh crash, harus ditolak (false)', () => {
    // Regresi bug: sebelumnya kode mengakses `user.role` langsung tanpa
    // optional chaining, sehingga saat request.user undefined, guard ini
    // melempar TypeError mentah alih-alih menolak dengan rapi.
    reflector.getAllAndOverride.mockReturnValue(['ADMINISTRATOR']);

    const context = createExecutionContextMock(undefined);

    expect(() => guard.canActivate(context)).not.toThrow();
    expect(guard.canActivate(context)).toBe(false);
  });
});
