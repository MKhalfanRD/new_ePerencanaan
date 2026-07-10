import { ExecutionContext } from '@nestjs/common';

/**
 * Guard NestJS (seperti RolesGuard) menerima objek `ExecutionContext` yang
 * berisi banyak method (getHandler, getClass, switchToHttp, dst). Di test,
 * kita tidak perlu request HTTP sungguhan — cukup buat objek palsu yang
 * bentuknya cukup mirip supaya method yang dipanggil guard tidak error.
 */
export const createExecutionContextMock = (user: unknown): ExecutionContext => {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getNext: () => jest.fn(),
    }),
  } as unknown as ExecutionContext;
};
