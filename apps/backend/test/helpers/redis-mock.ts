import { RedisService } from '../../src/redis/redis.service';

/**
 * Mock RedisService versi sederhana (manual, bukan jest-mock-extended)
 * karena method-nya sedikit dan sering perlu diatur perilakunya spesifik
 * per-test (mis. `get` pertama kali return null lalu return data di test lain).
 *
 * Default: `get` selalu return null (anggap cache MISS / kosong), supaya
 * test yang tidak peduli soal caching tidak perlu setup apa-apa.
 */
export type MockRedis = jest.Mocked<RedisService>;

export const createRedisMock = (): MockRedis =>
  ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPrefix: jest.fn().mockResolvedValue(undefined),
    setWithPrefix: jest.fn().mockResolvedValue(undefined),
  }) as unknown as MockRedis;
