import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

export type DependencyStatus = 'up' | 'down';

export interface HealthResult {
  status: 'ok' | 'error';
  db: DependencyStatus;
  redis: DependencyStatus;
}

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthResult> {
    const [db, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    return {
      status: db === 'up' && redis === 'up' ? 'ok' : 'error',
      db,
      redis,
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    try {
      await this.redis.ping();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
