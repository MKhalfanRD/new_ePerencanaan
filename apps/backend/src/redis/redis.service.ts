import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class RedisService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.cache.get<T>(key);
    return value !== undefined ? value : null;
  }

  // ttl dalam detik, dikonversi ke milidetik untuk cache-manager v7
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    await this.cache.set(
      key,
      value,
      ttlSeconds ? ttlSeconds * 1000 : undefined,
    );
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    const metaKey = `__prefix__${prefix}`;
    const keys = (await this.get<string[]>(metaKey)) ?? [];
    await Promise.all(keys.map((key) => this.cache.del(key)));
    await this.cache.del(metaKey);
  }

  async setWithPrefix(
    prefix: string,
    key: string,
    value: any,
    ttlSeconds?: number,
  ): Promise<void> {
    await this.set(key, value, ttlSeconds);
    const metaKey = `__prefix__${prefix}`;
    const existing = (await this.get<string[]>(metaKey)) ?? [];
    if (!existing.includes(key)) {
      await this.set(metaKey, [...existing, key], ttlSeconds);
    }
  }
}
