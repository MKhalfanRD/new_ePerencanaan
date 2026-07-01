import { Injectable, HttpException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

// Sumber data wilayah administratif Indonesia (gratis, tanpa API key)
const BASE_URL = 'https://www.emsifa.com/api-wilayah-indonesia/api';

@Injectable()
export class WilayahService {
  constructor(private redis: RedisService) {}

  private async fetchWithCache(path: string, cacheKey: string) {
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(`${BASE_URL}${path}`);
      if (!res.ok)
        throw new HttpException('Gagal mengambil data wilayah', res.status);
      const data = await res.json();

      // Cache lama karena data wilayah jarang berubah (7 hari)
      await this.redis.set(cacheKey, data, 60 * 60 * 24 * 7);
      return data;
    } catch (err) {
      throw new HttpException(
        'Layanan data wilayah sedang tidak tersedia',
        503,
      );
    }
  }

  getProvinces() {
    return this.fetchWithCache('/provinces.json', 'wilayah:provinces');
  }

  getRegencies(provinceId: string) {
    return this.fetchWithCache(
      `/regencies/${provinceId}.json`,
      `wilayah:regencies:${provinceId}`,
    );
  }

  getDistricts(regencyId: string) {
    return this.fetchWithCache(
      `/districts/${regencyId}.json`,
      `wilayah:districts:${regencyId}`,
    );
  }

  getVillages(districtId: string) {
    return this.fetchWithCache(
      `/villages/${districtId}.json`,
      `wilayah:villages:${districtId}`,
    );
  }
}
