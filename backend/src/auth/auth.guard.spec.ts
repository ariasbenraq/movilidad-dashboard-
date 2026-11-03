import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { Public } from './public.decorator.js';

class Controller {
  protectedRoute = () => {};
  @Public()
  publicRoute() {}
}

const context = (handler: () => void, cookies?: Record<string, unknown>) =>
  ({
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => ({ cookies }) }),
  }) as unknown as ExecutionContext;

describe('AuthGuard', () => {
  const verify = vi.fn();
  const guard = new AuthGuard(new Reflector(), { verify } as never);
  const c = new Controller();
  const publicRoute = Object.getOwnPropertyDescriptor(
    Controller.prototype,
    'publicRoute',
  )?.value as () => void;

  beforeEach(() => verify.mockReset());

  it('lets @Public() routes through without a cookie', async () => {
    await expect(guard.canActivate(context(publicRoute))).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a protected route with no cookie or an empty one', async () => {
    await expect(guard.canActivate(context(c.protectedRoute))).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(
      guard.canActivate(context(c.protectedRoute, { session: '' })),
    ).rejects.toThrow(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    verify.mockResolvedValue(null);
    await expect(
      guard.canActivate(context(c.protectedRoute, { session: 'bad' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid token', async () => {
    verify.mockResolvedValue({ username: 'renzo' });
    await expect(
      guard.canActivate(context(c.protectedRoute, { session: 'good' })),
    ).resolves.toBe(true);
  });
});
