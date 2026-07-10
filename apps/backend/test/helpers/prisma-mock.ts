import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

/**
 * MockPrisma = "kembaran palsu" dari PrismaClient asli, tapi:
 * - Tidak menyentuh database sungguhan sama sekali.
 * - Setiap method (mis. prisma.user.findUnique) otomatis jadi jest.fn()
 *   yang bisa kita atur hasilnya per-test lewat `.mockResolvedValue(...)`.
 * - Type-safe: TypeScript tetap tahu bentuk data yang benar untuk tiap model.
 */
export type MockPrisma = DeepMockProxy<PrismaClient>;

export const createPrismaMock = (): MockPrisma => mockDeep<PrismaClient>();
