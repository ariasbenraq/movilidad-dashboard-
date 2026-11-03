import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SESSION_COOKIE } from './auth.constants.js';
import { AuthService, SessionUser } from './auth.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

export type AuthedRequest = Request & { user?: SessionUser };

/** Global guard: every route needs a valid session cookie unless it is @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token === '') {
      throw new UnauthorizedException();
    }

    const user = await this.auth.verify(token);
    if (!user) throw new UnauthorizedException();
    request.user = user;
    return true;
  }
}
