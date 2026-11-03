// Needs a real Postgres and Redis. Run with RUN_INTEGRATION=1 and DB_*/REDIS_*
// pointing at a disposable database (the tables are dropped and recreated).
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import type { DistritoAnalitica } from '../analitica/analitica-distritos.service.js';
import { AppModule } from '../app.module.js';
import { CreateMovilidadRegistros1761700000000 } from '../migrations/1761700000000-CreateMovilidadRegistros.js';
import { ParserV21761800000000 } from '../migrations/1761800000000-ParserV2.js';
import { CreateConfigFeriados1762000000000 } from '../migrations/1762000000000-CreateConfigFeriados.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import type {
  Equivalencia,
  EquivalenciasResponse,
} from './equivalencias.service.js';

interface Seed {
  fecha: string;
  costo?: number;
  workorder?: string | null;
  cliente?: string | null;
  review?: string | null;
  origen?: string | null;
  origenCanon?: string | null;
  destino?: string | null;
  destinoCanon?: string | null;
}

describe.runIf(process.env.RUN_INTEGRATION === '1')('districts', () => {
  let app: INestApplication;
  let db: DataSource;
  let redis: Redis;
  let base: string;
  let cookie: string;
  let seq = 0;

  const call = async <T = Record<string, unknown>>(
    method: string,
    path: string,
    body?: unknown,
  ) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { cookie, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return {
      status: res.status,
      body: (text ? JSON.parse(text) : null) as T,
    };
  };
  const get = <T = Record<string, unknown>>(path: string) =>
    call<T>('GET', path);

  const seed = (r: Seed) =>
    db.query(
      `INSERT INTO movilidad_registros (
         gmail_message_id, received_at, fecha_form, periodo, costo_movilidad,
         workorder, cliente, review_reason, parser_version, distrito_origen,
         distrito_origen_canon, distrito_destino, distrito_destino_canon)
       VALUES ($1, now(), $2, $3, $4, $5, $6, $7, '2.0.0', $8, $9, $10, $11)`,
      [
        `seed${++seq}`,
        r.fecha,
        r.fecha.slice(0, 7),
        r.costo ?? 0,
        r.workorder ?? null,
        r.cliente ?? null,
        r.review ?? null,
        r.origen ?? null,
        r.origenCanon ?? null,
        r.destino ?? null,
        r.destinoCanon ?? null,
      ],
    );

  const reviews = async (): Promise<(string | null)[]> =>
    (
      await db.query<{ review_reason: string | null }[]>(
        `SELECT review_reason FROM movilidad_registros ORDER BY id`,
      )
    ).map((r) => r.review_reason);

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
    cookie = `session=${await app.get(JwtService).signAsync({ username: 'renzo' })}`;

    for (const table of [
      'feriados',
      'config',
      'distrito_equivalencias',
      'movilidad_registros',
    ]) {
      await db.query(`DROP TABLE IF EXISTS ${table}`);
    }
    const qr = db.createQueryRunner();
    await new CreateMovilidadRegistros1761700000000().up(qr);
    await new ParserV21761800000000().up(qr);
    await new CreateConfigFeriados1762000000000().up(qr);
    await qr.release();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await db.query('TRUNCATE movilidad_registros RESTART IDENTITY');
    await db.query('TRUNCATE distrito_equivalencias');
    const keys = await redis.keys('movilidad:v1:*');
    if (keys.length) await redis.del(...keys);
  });

  it.each([
    ['GET', '/distritos/equivalencias'],
    ['PUT', '/distritos/equivalencias'],
    ['DELETE', '/distritos/equivalencias/sjm'],
    ['GET', '/analitica/distritos'],
  ])('%s %s answers 401 without a session', async (method, path) => {
    const res = await fetch(`${base}${path}`, { method });
    expect(res.status).toBe(401);
  });

  describe('equivalences', () => {
    it('lists equivalences and the unmapped texts, most used first', async () => {
      await db.query(
        `INSERT INTO distrito_equivalencias VALUES ('surco','Santiago de Surco')`,
      );
      await seed({
        fecha: '2025-03-05',
        origen: 'Sjm',
        destino: 'Surco',
        destinoCanon: 'Santiago de Surco',
      });
      await seed({ fecha: '2025-03-06', origen: 'SJM', destino: 'Sjm' });
      await seed({ fecha: '2025-03-07', origen: 'Chorrillos' });

      const { status, body } = await get<EquivalenciasResponse>(
        '/distritos/equivalencias',
      );
      expect(status).toBe(200);
      expect(body.items).toEqual([
        { texto_normalizado: 'surco', distrito: 'Santiago de Surco' },
      ]);
      expect(body.sin_mapear).toEqual([
        { texto: 'Sjm', registros: 2 },
        { texto: 'Chorrillos', registros: 1 },
      ]);
    });

    it('PUT stores a normalized key and re-derives the canon columns and flag', async () => {
      await seed({
        fecha: '2025-03-05',
        origen: 'Sjm',
        destino: 'Jesús María',
        review: 'unknown_district',
      });
      await seed({
        fecha: '2025-03-06',
        origen: 'SJM',
        destino: 'Jesús María',
        review: 'possible_duplicate,unknown_district',
      });
      await seed({
        fecha: '2025-03-07',
        origen: 'Surco',
        destino: 'Surco',
        review: 'unknown_district',
      });

      const put = await call<Equivalencia>('PUT', '/distritos/equivalencias', {
        texto: '  Sjm ',
        distrito: 'San Juan de Lurigancho',
      });
      expect(put.status).toBe(200);
      expect(put.body).toEqual({
        texto_normalizado: 'sjm',
        distrito: 'San Juan de Lurigancho',
      });

      const rows = await db.query<
        {
          distrito_origen_canon: string | null;
          distrito_destino_canon: string | null;
        }[]
      >(
        `SELECT distrito_origen_canon, distrito_destino_canon FROM movilidad_registros ORDER BY id`,
      );
      expect(rows.map((r) => r.distrito_origen_canon)).toEqual([
        'San Juan de Lurigancho',
        'San Juan de Lurigancho',
        null,
      ]);
      // Destination still has no equivalence, so the flag stays on the first two.
      expect(await reviews()).toEqual([
        'unknown_district',
        'possible_duplicate,unknown_district',
        'unknown_district',
      ]);

      await call('PUT', '/distritos/equivalencias', {
        texto: 'jesus maria',
        distrito: 'Jesús María',
      });
      expect(await reviews()).toEqual([
        null,
        'possible_duplicate',
        'unknown_district',
      ]);
      const needs = await db.query<{ needs_review: boolean }[]>(
        `SELECT needs_review FROM movilidad_registros ORDER BY id`,
      );
      expect(needs.map((r) => r.needs_review)).toEqual([false, true, true]);
    });

    it('PUT over an existing key replaces the canonical name everywhere', async () => {
      await db.query(`INSERT INTO distrito_equivalencias VALUES ('sjm','SJL')`);
      await seed({
        fecha: '2025-03-05',
        origen: 'Sjm',
        origenCanon: 'SJL',
        destino: 'Sjm',
        destinoCanon: 'SJL',
      });
      await call('PUT', '/distritos/equivalencias', {
        texto: 'sjm',
        distrito: 'San Juan de Lurigancho',
      });
      const [row] = await db.query<{ a: string; b: string }[]>(
        `SELECT distrito_origen_canon AS a, distrito_destino_canon AS b FROM movilidad_registros`,
      );
      expect(row).toEqual({
        a: 'San Juan de Lurigancho',
        b: 'San Juan de Lurigancho',
      });
      expect(
        (await get<EquivalenciasResponse>('/distritos/equivalencias')).body
          .items,
      ).toHaveLength(1);
    });

    it('DELETE removes the equivalence and the records become unmapped again', async () => {
      await db.query(
        `INSERT INTO distrito_equivalencias VALUES ('sjm','San Juan de Lurigancho')`,
      );
      await seed({
        fecha: '2025-03-05',
        origen: 'Sjm',
        origenCanon: 'San Juan de Lurigancho',
      });
      await seed({
        fecha: '2025-03-06',
        origen: 'Sjm',
        origenCanon: 'San Juan de Lurigancho',
        review: 'possible_duplicate',
      });

      expect(
        (await call('DELETE', '/distritos/equivalencias/sjm')).status,
      ).toBe(204);
      expect(await reviews()).toEqual([
        'unknown_district',
        'possible_duplicate,unknown_district',
      ]);
      const list = (
        await get<EquivalenciasResponse>('/distritos/equivalencias')
      ).body;
      expect(list.items).toEqual([]);
      expect(list.sin_mapear).toEqual([{ texto: 'Sjm', registros: 2 }]);
    });

    it('DELETE accepts an encoded key with spaces and answers 404 when missing', async () => {
      await db.query(
        `INSERT INTO distrito_equivalencias VALUES ('jesus maria','Jesús María')`,
      );
      expect(
        (await call('DELETE', '/distritos/equivalencias/jesus%20maria')).status,
      ).toBe(204);
      expect(
        (await call('DELETE', '/distritos/equivalencias/jesus%20maria')).status,
      ).toBe(404);
      expect(
        (await call('DELETE', '/distritos/equivalencias/nunca')).status,
      ).toBe(404);
    });

    it.each([
      [{ texto: '', distrito: 'X' }],
      [{ texto: '   ', distrito: 'X' }],
      [{ texto: 'x', distrito: '' }],
      [{ texto: 'x'.repeat(101), distrito: 'X' }],
      [{ texto: 'x', distrito: 'X'.repeat(101) }],
      [{ texto: 'x' }],
      [{ texto: 5, distrito: 'X' }],
    ])('PUT rejects %j with 400', async (body) => {
      expect((await call('PUT', '/distritos/equivalencias', body)).status).toBe(
        400,
      );
      const count = await db.query<{ n: number }[]>(
        `SELECT COUNT(*)::int AS n FROM distrito_equivalencias`,
      );
      expect(count[0].n).toBe(0);
    });

    it('invalidates the caches of the affected periods and the district analytics', async () => {
      await seed({
        fecha: '2025-03-05',
        origen: 'Sjm',
        review: 'unknown_district',
      });
      await seed({ fecha: '2025-04-05', origen: 'Otro' });
      await get('/resumen?periodo=2025-03');
      await get('/resumen?periodo=2025-04');
      await get('/analitica/distritos?periodo=2025-03');
      await get('/analitica/distritos?periodo=2025-04');
      expect((await get('/resumen?periodo=2025-03')).body).toMatchObject({
        por_revisar: 1,
      });

      await call('PUT', '/distritos/equivalencias', {
        texto: 'sjm',
        distrito: 'San Juan de Lurigancho',
      });

      expect(await redis.exists('movilidad:v1:2025-03:resumen')).toBe(0);
      expect(await redis.exists('movilidad:v1:2025-03:distritos')).toBe(0);
      expect(await redis.exists('movilidad:v1:2025-04:distritos')).toBe(0);
      // A period with no affected record keeps its summary.
      expect(await redis.exists('movilidad:v1:2025-04:resumen')).toBe(1);
      expect((await get('/resumen?periodo=2025-03')).body).toMatchObject({
        por_revisar: 0,
      });
    });
  });

  describe('GET /analitica/distritos', () => {
    beforeEach(async () => {
      const JM = 'Jesús María';
      // 2025-03: JM x3 (BCP x2, IBK x1; W1 x2, W2 x1), SJL x1, unmapped x2 (one without destination).
      await seed({
        fecha: '2025-03-03',
        costo: 20,
        cliente: 'BCP',
        workorder: 'W1',
        destino: 'Jesus Maria',
        destinoCanon: JM,
      });
      await seed({
        fecha: '2025-03-04',
        costo: 30,
        cliente: 'BCP',
        workorder: 'W1',
        destino: 'Jesus Maria',
        destinoCanon: JM,
      });
      await seed({
        fecha: '2025-03-05',
        costo: 10.5,
        cliente: 'IBK',
        workorder: 'W2',
        destino: 'Jesus Maria',
        destinoCanon: JM,
      });
      await seed({
        fecha: '2025-03-06',
        costo: 8,
        cliente: 'BCP',
        workorder: 'W3',
        destino: 'Sjm',
        destinoCanon: 'San Juan de Lurigancho',
      });
      await seed({ fecha: '2025-03-07', costo: 5, destino: 'Rarolandia' });
      await seed({ fecha: '2025-03-08', costo: 7 });
      // Earlier and later months of the same year, and a previous year.
      await seed({
        fecha: '2025-01-10',
        costo: 9,
        destino: 'Jesus Maria',
        destinoCanon: JM,
      });
      await seed({
        fecha: '2025-02-10',
        costo: 9,
        destino: 'Jesus Maria',
        destinoCanon: JM,
      });
      await seed({
        fecha: '2025-04-10',
        costo: 9,
        destino: 'Jesus Maria',
        destinoCanon: JM,
      });
      await seed({
        fecha: '2024-12-10',
        costo: 9,
        destino: 'Jesus Maria',
        destinoCanon: JM,
      });
    });

    it('groups visits by canonical destination, with the unmapped ones under null', async () => {
      const { status, body } = await get<{
        periodo: string;
        items: DistritoAnalitica[];
      }>('/analitica/distritos?periodo=2025-03');
      expect(status).toBe(200);
      expect(body.periodo).toBe('2025-03');
      expect(body.items.map((i) => [i.distrito, i.visitas])).toEqual([
        ['Jesús María', 3],
        [null, 2],
        ['San Juan de Lurigancho', 1],
      ]);
    });

    it('returns costs, clients and workorders per district', async () => {
      const { body } = await get<{ items: DistritoAnalitica[] }>(
        '/analitica/distritos?periodo=2025-03',
      );
      const jm = body.items[0];
      expect(jm.costo_total).toBe(60.5);
      expect(jm.costo_promedio).toBe(20.17);
      expect(jm.clientes).toEqual([
        { cliente: 'BCP', visitas: 2 },
        { cliente: 'IBK', visitas: 1 },
      ]);
      expect(jm.workorders).toEqual([
        { workorder: 'W1', visitas: 2 },
        { workorder: 'W2', visitas: 1 },
      ]);
      const unmapped = body.items[1];
      expect(unmapped).toMatchObject({
        distrito: null,
        costo_total: 12,
        costo_promedio: 6,
        clientes: [],
        workorders: [],
      });
    });

    it('estimates the year: visits through the requested month + month visits x months left', async () => {
      const { body } = await get<{ items: DistritoAnalitica[] }>(
        '/analitica/distritos?periodo=2025-03',
      );
      // Jan + Feb + Mar visits; April and 2024 are outside "January 1 through March".
      expect(body.items[0]).toMatchObject({
        visitas_anio_hasta_hoy: 5,
        meses_restantes: 9,
        visitas_anio_estimadas: 5 + 3 * 9,
      });
      expect(body.items[2]).toMatchObject({
        visitas_anio_hasta_hoy: 1,
        visitas_anio_estimadas: 1 + 1 * 9,
      });
    });

    it('returns the year totals for December with no months left', async () => {
      await seed({
        fecha: '2025-12-02',
        costo: 1,
        destino: 'Jesus Maria',
        destinoCanon: 'Jesús María',
      });
      const { body } = await get<{ items: DistritoAnalitica[] }>(
        '/analitica/distritos?periodo=2025-12',
      );
      expect(body.items[0]).toMatchObject({
        visitas: 1,
        visitas_anio_hasta_hoy: 7, // Jan, Feb, 3 in Mar, Apr and Dec
        meses_restantes: 0,
        visitas_anio_estimadas: 7,
      });
    });

    it('limits workorders to the 10 most visited', async () => {
      for (let i = 1; i <= 12; i++) {
        await seed({
          fecha: '2025-06-01',
          costo: 1,
          workorder: `W${String(i).padStart(2, '0')}`,
          destino: 'X',
          destinoCanon: 'Barranco',
        });
      }
      await seed({
        fecha: '2025-06-02',
        costo: 1,
        workorder: 'W12',
        destino: 'X',
        destinoCanon: 'Barranco',
      });
      const { body } = await get<{ items: DistritoAnalitica[] }>(
        '/analitica/distritos?periodo=2025-06',
      );
      expect(body.items[0].workorders).toHaveLength(10);
      expect(body.items[0].workorders[0]).toEqual({
        workorder: 'W12',
        visitas: 2,
      });
    });

    it('answers an empty period with no items and rejects a bad one', async () => {
      expect((await get('/analitica/distritos?periodo=2025-08')).body).toEqual({
        periodo: '2025-08',
        items: [],
      });
      expect((await get('/analitica/distritos?periodo=2025-13')).status).toBe(
        400,
      );
    });

    it('is cached per period and dropped by an ingest of that period', async () => {
      await get('/analitica/distritos?periodo=2025-03');
      expect(await redis.exists('movilidad:v1:2025-03:distritos')).toBe(1);
      await fetch(`${base}/ingest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key':
            process.env.INGEST_API_KEY ??
            'integration-test-key-0123456789abcdef0123',
        },
        body: JSON.stringify({
          gmail_message_id: 'dist-cache',
          received_at: '2025-03-09T10:00:00-05:00',
          fecha_form: '2025-03-09',
          costo_movilidad: 1,
          parser_version: '2.0.0',
        }),
      });
      expect(await redis.exists('movilidad:v1:2025-03:distritos')).toBe(0);
    });
  });
});
