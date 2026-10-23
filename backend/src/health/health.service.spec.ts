import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  let service: HealthService;
  let db: { query: ReturnType<typeof vi.fn> };
  let redis: { ping: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    db = { query: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    redis = { ping: vi.fn().mockResolvedValue('PONG') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: getDataSourceToken(), useValue: db },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('reports ok when Postgres and Redis are reachable', async () => {
    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      redis: 'up',
    });
    expect(db.query).toHaveBeenCalledWith('SELECT 1');
    expect(redis.ping).toHaveBeenCalled();
  });

  it('reports the database as down when the query fails', async () => {
    db.query.mockRejectedValueOnce(new Error('connection refused'));

    await expect(service.check()).resolves.toEqual({
      status: 'error',
      db: 'down',
      redis: 'up',
    });
  });

  it('reports redis as down when PING fails', async () => {
    redis.ping.mockRejectedValueOnce(new Error('connection refused'));

    await expect(service.check()).resolves.toEqual({
      status: 'error',
      db: 'up',
      redis: 'down',
    });
  });
});
