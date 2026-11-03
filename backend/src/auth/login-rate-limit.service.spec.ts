import { HttpException } from '@nestjs/common';
import { LoginRateLimitService } from './login-rate-limit.service.js';

describe('LoginRateLimitService', () => {
  const redis = { get: vi.fn(), multi: vi.fn(), del: vi.fn() };
  const service = new LoginRateLimitService(redis as never);

  beforeEach(() => {
    redis.get.mockReset();
    redis.del.mockReset();
  });

  it('allows fewer than 5 failures', async () => {
    redis.get.mockResolvedValue('4');
    await expect(service.assertAllowed('1.1.1.1')).resolves.toBeUndefined();
  });

  it('answers 429 from the 5th failure', async () => {
    redis.get.mockResolvedValue('5');
    const error = await service
      .assertAllowed('1.1.1.1')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
  });

  it('does not block login when Redis is down', async () => {
    redis.get.mockRejectedValue(new Error('down'));
    await expect(service.assertAllowed('1.1.1.1')).resolves.toBeUndefined();
    redis.multi.mockImplementation(() => {
      throw new Error('down');
    });
    await expect(service.recordFailure('1.1.1.1')).resolves.toBeUndefined();
    redis.del.mockRejectedValue(new Error('down'));
    await expect(service.reset('1.1.1.1')).resolves.toBeUndefined();
  });
});
