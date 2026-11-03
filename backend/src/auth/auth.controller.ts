import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from './auth.constants.js';
import type { AuthedRequest } from './auth.guard.js';
import { clientIp } from './auth.rules.js';
import { AuthService } from './auth.service.js';
import { LoginRateLimitService } from './login-rate-limit.service.js';
import { LoginDto } from './login.dto.js';
import { Public } from './public.decorator.js';

@Controller('auth')
export class AuthController {
  private readonly trustProxy: boolean;
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly auth: AuthService,
    private readonly rateLimit: LoginRateLimitService,
    config: ConfigService,
  ) {
    this.trustProxy = String(config.get('TRUST_PROXY')) === 'true';
    this.cookieOptions = {
      httpOnly: true,
      secure: config.get<string>('NODE_ENV') !== 'development',
      sameSite: 'lax',
      path: '/',
    };
  }

  @Public()
  @Post('login')
  @HttpCode(204)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const ip = clientIp(req.headers, req.socket.remoteAddress, this.trustProxy);
    await this.rateLimit.assertAllowed(ip);

    let token: string;
    try {
      token = await this.auth.login(dto.username, dto.password);
    } catch (error) {
      await this.rateLimit.recordFailure(ip);
      throw error;
    }

    await this.rateLimit.reset(ip);
    res.cookie(SESSION_COOKIE, token, {
      ...this.cookieOptions,
      maxAge: SESSION_MAX_AGE_SECONDS * 1000,
    });
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions);
  }

  @Get('me')
  me(@Req() req: AuthedRequest): { username: string } {
    return { username: req.user?.username ?? '' };
  }
}
