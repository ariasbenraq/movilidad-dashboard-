import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard.js';

const KEY = 'k'.repeat(40);

const contextWith = (headers: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

describe('ApiKeyGuard', () => {
  const guard = new ApiKeyGuard({
    getOrThrow: () => KEY,
  } as unknown as ConfigService);

  it('accepts the right key', () => {
    expect(guard.canActivate(contextWith({ 'x-api-key': KEY }))).toBe(true);
  });
  it('rejects a missing key', () => {
    expect(() => guard.canActivate(contextWith({}))).toThrow(
      UnauthorizedException,
    );
  });
  it('rejects a wrong key, including one of a different length', () => {
    expect(() => guard.canActivate(contextWith({ 'x-api-key': 'x' }))).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      guard.canActivate(contextWith({ 'x-api-key': `${KEY}x` })),
    ).toThrow(UnauthorizedException);
  });
  it('rejects a repeated header (array)', () => {
    expect(() =>
      guard.canActivate(contextWith({ 'x-api-key': [KEY, KEY] })),
    ).toThrow(UnauthorizedException);
  });
});
