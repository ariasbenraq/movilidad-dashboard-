import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';
import { RedisLifecycle } from './redis.lifecycle.js';

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: Number(config.getOrThrow<string>('REDIS_PORT')),
          maxRetriesPerRequest: 1,
        }),
    },
    RedisLifecycle,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
