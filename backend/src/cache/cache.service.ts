import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { cacheKeys } from './cache.keys.js';

export const CACHE_TTL_SECONDS = 300;

/** Redis is an optimization, never a dependency: every failure falls back to the loader. */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async wrap<T>(key: string, loader: () => Promise<T>): Promise<T> {
    try {
      const hit = await this.redis.get(key);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (error) {
      this.logger.warn(`Cache read failed: ${(error as Error).message}`);
    }

    const value = await loader();

    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Cache write failed: ${(error as Error).message}`);
    }
    return value;
  }

  /** Deletes every cache key of the period. Never throws. */
  async invalidatePeriodo(periodo: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          cacheKeys.periodoPattern(periodo),
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(
        `Cache invalidation failed for ${periodo}: ${(error as Error).message}`,
      );
    }
  }
}
