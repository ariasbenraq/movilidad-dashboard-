import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { SESSION_MAX_AGE_SECONDS } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { LoginRateLimitService } from './login-rate-limit.service.js';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256' as const,
          expiresIn: SESSION_MAX_AGE_SECONDS,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginRateLimitService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
