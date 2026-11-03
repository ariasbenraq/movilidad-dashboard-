import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_SECONDS } from './auth.constants.js';

/** Failed logins per IP in a fixed window. If Redis is down, login still works. */
@Injectable()
export class LoginRateLimitService {
  private readonly logger = new Logger(LoginRateLimitService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(ip: string): string {
    return `movilidad:auth:login-fail:${ip}`;
  }

  async assertAllowed(ip: string): Promise<void> {
    let failures = 0;
    try {
      failures = Number(await this.redis.get(this.key(ip))) || 0;
    } catch (error) {
      this.logger.warn(`Rate limit read failed: ${(error as Error).message}`);
    }
    if (failures >= LOGIN_MAX_FAILURES) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many failed login attempts, try again later',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(ip: string): Promise<void> {
    try {
      await this.redis
        .multi()
        .incr(this.key(ip))
        .expire(this.key(ip), LOGIN_WINDOW_SECONDS, 'NX')
        .exec();
    } catch (error) {
      this.logger.warn(`Rate limit write failed: ${(error as Error).message}`);
    }
  }

  async reset(ip: string): Promise<void> {
    try {
      await this.redis.del(this.key(ip));
    } catch (error) {
      this.logger.warn(`Rate limit reset failed: ${(error as Error).message}`);
    }
  }
}
