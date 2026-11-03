// Needs a real Postgres and Redis. Run with RUN_INTEGRATION=1 and DB_*/REDIS_*
// pointing at a disposable database (the users table is dropped and recreated).
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { CreateUsers1761900000000 } from '../migrations/1761900000000-CreateUsers.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

const PUBLIC_ROUTES = ['/health', '/ingest', '/auth/login', '/auth/logout'];

describe.runIf(process.env.RUN_INTEGRATION === '1')('auth', () => {
  let app: INestApplication;
  let db: DataSource;
  let redis: Redis;
  let jwt: JwtService;
  let base: string;

  const login = (username: string, password: string) =>
    fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

  const sessionOf = (res: Response): string | undefined =>
    res.headers
      .getSetCookie()
      .find((c) => c.startsWith('session='))
      ?.split(';')[0];

  const me = (cookie?: string) =>
    fetch(`${base}/auth/me`, { headers: cookie ? { cookie } : {} });

  const clearLimits = async () => {
    const keys = await redis.keys('movilidad:auth:*');
    if (keys.length) await redis.del(...keys);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    db = app.get(getDataSourceToken());
    redis = app.get(REDIS_CLIENT);
    jwt = app.get(JwtService);

    await db.query('DROP TABLE IF EXISTS users');
    const qr = db.createQueryRunner();
    await new CreateUsers1761900000000().up(qr);
    await qr.release();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await db.query('TRUNCATE users RESTART IDENTITY');
    await db.query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2)`,
      ['renzo', await argon2.hash('correct-password')],
    );
    await clearLimits();
  });

  it('logs in with a 204 and an httpOnly session cookie that opens /auth/me', async () => {
    const res = await login('renzo', 'correct-password');
    expect(res.status).toBe(204);
    const setCookie = res.headers
      .getSetCookie()
      .find((c) => c.startsWith('session='));
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Max-Age=604800/);
    expect(setCookie).toMatch(/Path=\//);

    const meRes = await me(sessionOf(res));
    expect(meRes.status).toBe(200);
    expect(await meRes.json()).toEqual({ username: 'renzo' });
  });

  it('answers 401 with the same body for a wrong password and an unknown user', async () => {
    const wrong = await login('renzo', 'nope');
    const unknown = await login('ghost', 'nope');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(sessionOf(wrong)).toBeUndefined();
  });

  it('answers 400 for a malformed body without echoing the password', async () => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'renzo', password: 123456 }),
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain('123456');
  });

  it('blocks the 6th attempt with 429, even with the right password', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await login('renzo', 'nope')).status).toBe(401);
    }
    expect((await login('renzo', 'correct-password')).status).toBe(429);
  });

  it('resets the counter after a successful login', async () => {
    for (let i = 0; i < 4; i++) await login('renzo', 'nope');
    expect((await login('renzo', 'correct-password')).status).toBe(204);
    for (let i = 0; i < 4; i++) {
      expect((await login('renzo', 'nope')).status).toBe(401);
    }
  });

  it('rejects /auth/me without a cookie, with an expired token and with a forged one', async () => {
    expect((await me()).status).toBe(401);
    const expired = await jwt.signAsync(
      { username: 'renzo' },
      { expiresIn: -10 },
    );
    expect((await me(`session=${expired}`)).status).toBe(401);
    const forged = await new JwtService({ secret: 'x'.repeat(40) }).signAsync({
      username: 'renzo',
    });
    expect((await me(`session=${forged}`)).status).toBe(401);
    expect((await me('session=garbage')).status).toBe(401);
  });

  it('logout clears the cookie and works without a session', async () => {
    const res = await fetch(`${base}/auth/logout`, { method: 'POST' });
    expect(res.status).toBe(204);
    const cleared = res.headers
      .getSetCookie()
      .find((c) => c.startsWith('session='));
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('requires the session cookie on every route that is not public', async () => {
    const router = (
      app.getHttpAdapter().getInstance() as {
        router: {
          stack: {
            route?: { path: string; methods: Record<string, boolean> };
          }[];
        };
      }
    ).router;
    const routes = router.stack
      .filter((layer) => layer.route)
      .flatMap((layer) =>
        Object.keys(layer.route?.methods ?? {}).map((method) => ({
          method: method.toUpperCase(),
          path: layer.route?.path ?? '',
        })),
      )
      .filter((r) => !PUBLIC_ROUTES.includes(r.path));

    // Not vacuous: /auth/me must have been found.
    expect(routes.map((r) => r.path)).toContain('/auth/me');
    for (const { method, path } of routes) {
      const res = await fetch(`${base}${path}`, { method });
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });
});
