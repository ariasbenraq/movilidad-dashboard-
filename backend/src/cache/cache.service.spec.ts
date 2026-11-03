import { CACHE_TTL_SECONDS, CacheService } from './cache.service.js';

describe('CacheService', () => {
  const redis = { get: vi.fn(), set: vi.fn(), scan: vi.fn(), del: vi.fn() };
  const cache = new CacheService(redis as never);

  beforeEach(() => {
    for (const fn of Object.values(redis)) fn.mockReset();
  });

  it('returns the cached value without calling the loader', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ a: 1 }));
    const loader = vi.fn();
    await expect(cache.wrap('k', loader)).resolves.toEqual({ a: 1 });
    expect(loader).not.toHaveBeenCalled();
  });

  it('loads and stores with a 300 s TTL on a miss', async () => {
    redis.get.mockResolvedValue(null);
    const loader = vi.fn().mockResolvedValue({ a: 2 });
    await expect(cache.wrap('k', loader)).resolves.toEqual({ a: 2 });
    expect(redis.set).toHaveBeenCalledWith(
      'k',
      '{"a":2}',
      'EX',
      CACHE_TTL_SECONDS,
    );
    expect(CACHE_TTL_SECONDS).toBe(300);
  });

  it('serves from the loader when Redis is down', async () => {
    redis.get.mockRejectedValue(new Error('down'));
    redis.set.mockRejectedValue(new Error('down'));
    await expect(cache.wrap('k', async () => 5)).resolves.toBe(5);
  });

  it('invalidates every key of the period and never throws', async () => {
    redis.scan
      .mockResolvedValueOnce(['7', ['movilidad:v1:2026-10:resumen']])
      .mockResolvedValueOnce(['0', ['movilidad:v1:2026-10:diario']]);
    await cache.invalidatePeriodo('2026-10');
    expect(redis.scan.mock.calls[0][2]).toBe('movilidad:v1:2026-10:*');
    expect(redis.del).toHaveBeenCalledTimes(2);

    redis.scan.mockRejectedValue(new Error('down'));
    await expect(cache.invalidatePeriodo('2026-10')).resolves.toBeUndefined();
  });
});
