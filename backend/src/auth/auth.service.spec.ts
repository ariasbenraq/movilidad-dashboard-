import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service.js';

vi.mock('argon2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('argon2')>();
  return { ...actual, verify: vi.fn(actual.verify) };
});

const SECRET = 's'.repeat(40);

describe('AuthService', () => {
  let jwt: JwtService;
  let query: ReturnType<typeof vi.fn>;
  let service: AuthService;
  let hash: string;

  beforeAll(async () => {
    hash = await argon2.hash('correct-password');
  });

  beforeEach(() => {
    jwt = new JwtService({
      secret: SECRET,
      signOptions: { algorithm: 'HS256', expiresIn: 60 },
    });
    query = vi
      .fn()
      .mockResolvedValue([{ username: 'renzo', password_hash: hash }]);
    service = new AuthService({ query } as never, jwt);
  });

  it('returns a token that verifies back to the username', async () => {
    const token = await service.login('renzo', 'correct-password');
    await expect(service.verify(token)).resolves.toEqual({ username: 'renzo' });
  });

  it('rejects a wrong password and an unknown user with the same error', async () => {
    const wrong = await service.login('renzo', 'nope').catch((e: unknown) => e);
    query.mockResolvedValue([]);
    const unknown = await service
      .login('ghost', 'nope')
      .catch((e: unknown) => e);
    expect(wrong).toBeInstanceOf(UnauthorizedException);
    expect(unknown).toBeInstanceOf(UnauthorizedException);
    expect((wrong as Error).message).toBe((unknown as Error).message);
  });

  it('verifies the dummy hash for an unknown user (no early return)', async () => {
    query.mockResolvedValue([]);
    vi.mocked(argon2.verify).mockClear();
    await service.login('ghost', 'whatever').catch(() => undefined);
    expect(argon2.verify).toHaveBeenCalledTimes(1);
  });

  it('rejects expired, forged and malformed tokens', async () => {
    const expired = await jwt.signAsync(
      { username: 'renzo' },
      { expiresIn: -10 },
    );
    const forged = await new JwtService({ secret: 'x'.repeat(40) }).signAsync({
      username: 'renzo',
    });
    const noUsername = await jwt.signAsync({ sub: '1' });
    for (const token of [expired, forged, noUsername, 'garbage']) {
      await expect(service.verify(token)).resolves.toBeNull();
    }
  });
});
