// Needs a real Postgres and Redis. Run with RUN_INTEGRATION=1 and DB_*/REDIS_*
// pointing at a disposable database (the table is truncated).
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { CreateMovilidadRegistros1761700000000 } from '../migrations/1761700000000-CreateMovilidadRegistros.js';

const KEY = 'integration-test-key-0123456789abcdef0123';

describe.runIf(process.env.RUN_INTEGRATION === '1')('POST /ingest', () => {
  let app: INestApplication;
  let db: DataSource;
  let redis: Redis;
  let url: string;

  const payload = (over: Record<string, unknown> = {}) => ({
    gmail_message_id: 'msg1',
    received_at: '2026-10-07T20:41:00-05:00',
    fecha_form: '2026-10-07',
    costo_movilidad: 29.9,
    otros_gastos: 6.5,
    otros_detalle: 'Isopos',
    workorder: 'W610052371',
    cliente: 'BCP',
    parser_version: '1.0.0',
    ...over,
  });

  const post = (body: unknown, key: string | null = KEY) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(key === null ? {} : { 'x-api-key': key }),
      },
      body: JSON.stringify(body),
    });

  const rows = (): Promise<Record<string, unknown>[]> =>
    db.query('SELECT * FROM movilidad_registros ORDER BY id');

  beforeAll(async () => {
    process.env.INGEST_API_KEY = KEY;
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/ingest`.replace('[::1]', '127.0.0.1');
    db = app.get(getDataSourceToken());
    redis = app.get(REDIS_CLIENT);

    await db.query('DROP TABLE IF EXISTS movilidad_registros');
    const qr = db.createQueryRunner();
    await new CreateMovilidadRegistros1761700000000().up(qr);
    await qr.release();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await db.query('TRUNCATE movilidad_registros RESTART IDENTITY');
    const keys = await redis.keys('movilidad:v1:*');
    if (keys.length) await redis.del(...keys);
  });

  it('rejects a missing or wrong API key with 401', async () => {
    expect((await post(payload(), null)).status).toBe(401);
    expect((await post(payload(), 'wrong')).status).toBe(401);
    expect(await rows()).toHaveLength(0);
  });

  it('creates a row and derives the fields', async () => {
    const res = await post(
      payload({ he_inicio: '23:00', he_fin: '01:00' }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ status: 'created', id: 1 });
    const [row] = await rows();
    expect(row).toMatchObject({
      periodo: '2026-10',
      costo_movilidad: '29.90',
      otros_gastos: '6.50',
      he_minutos: 120,
      review_reason: null,
      needs_review: false,
    });
  });

  it('treats missing or null amounts as 0 and flags no_amounts', async () => {
    const res = await post(
      payload({ costo_movilidad: null, otros_gastos: undefined, workorder: null }),
    );
    expect(res.status).toBe(201);
    const [row] = await rows();
    expect(row).toMatchObject({
      costo_movilidad: '0.00',
      otros_gastos: '0.00',
      review_reason: 'no_amounts',
      needs_review: true,
    });
  });

  it('trims strings and turns empty strings into null', async () => {
    await post(payload({ cliente: '  BCP  ', otros_detalle: '   ' }));
    const [row] = await rows();
    expect(row).toMatchObject({ cliente: 'BCP', otros_detalle: null });
  });

  it('answers 200 duplicate on a retry, even with a changed payload', async () => {
    await post(payload());
    const res = await post(payload({ costo_movilidad: 99 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'duplicate' });
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0].costo_movilidad).toBe('29.90');
  });

  it('stores one row for concurrent retries of the same message', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => post(payload())),
    );
    const statuses = results.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 200)).toHaveLength(9);
    expect(await rows()).toHaveLength(1);
  });

  it('flags exactly one of several concurrent inserts of the same expense', async () => {
    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        post(payload({ gmail_message_id: `dup${i}` })),
      ),
    );
    const all = await rows();
    expect(all).toHaveLength(6);
    expect(all.filter((r) => r.review_reason === null)).toHaveLength(1);
    expect(
      all.filter((r) => r.review_reason === 'possible_duplicate'),
    ).toHaveLength(5);
  });

  it('never flags a duplicate when workorder is null', async () => {
    await post(payload({ gmail_message_id: 'a', workorder: null }));
    await post(payload({ gmail_message_id: 'b', workorder: null }));
    expect((await rows()).map((r) => r.review_reason)).toEqual([null, null]);
  });

  it.each([
    ['unknown field', { extra: 1 }],
    ['amount as string', { costo_movilidad: '29.9' }],
    ['3 decimals', { costo_movilidad: 29.123 }],
    ['amount over 5000', { otros_gastos: 5000.01 }],
    ['negative amount', { costo_movilidad: -1 }],
    ['time with seconds', { he_inicio: '17:00:00' }],
    ['time out of range', { he_fin: '24:00' }],
    ['impossible date', { fecha_form: '2026-02-30' }],
    ['date before 2020', { fecha_form: '2019-12-31' }],
    ['date after tomorrow', { fecha_form: '2099-01-01' }],
    ['received_at without offset', { received_at: '2026-10-07T20:41:00' }],
    ['bad message id', { gmail_message_id: 'a b' }],
    ['detail too long', { otros_detalle: 'x'.repeat(501) }],
    ['missing parser_version', { parser_version: undefined }],
  ])('rejects %s with 400 and does not echo the payload', async (_n, over) => {
    const res = await post(payload(over));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(Array.isArray(body.message)).toBe(true);
    expect(JSON.stringify(body)).not.toContain('W610052371');
    expect(await rows()).toHaveLength(0);
  });

  it('invalidates only the cache keys of the ingested period', async () => {
    await redis.set('movilidad:v1:2026-10:resumen', '1');
    await redis.set('movilidad:v1:2026-10:registros:1:20', '1');
    await redis.set('movilidad:v1:2026-09:resumen', '1');
    await post(payload());
    expect(await redis.keys('movilidad:v1:2026-10:*')).toEqual([]);
    expect(await redis.keys('movilidad:v1:2026-09:*')).toHaveLength(1);
  });

  it('keeps the cache on a duplicate', async () => {
    await post(payload());
    await redis.set('movilidad:v1:2026-10:resumen', '1');
    await post(payload());
    expect(await redis.exists('movilidad:v1:2026-10:resumen')).toBe(1);
  });
});
