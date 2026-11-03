// Needs a real Postgres and Redis. Run with RUN_INTEGRATION=1 and DB_*/REDIS_*
// pointing at a disposable database (the tables are dropped and recreated).
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { todayIn } from '../ingest/ingest.rules.js';
import { CreateMovilidadRegistros1761700000000 } from '../migrations/1761700000000-CreateMovilidadRegistros.js';
import { ParserV21761800000000 } from '../migrations/1761800000000-ParserV2.js';
import { CreateConfigFeriados1762000000000 } from '../migrations/1762000000000-CreateConfigFeriados.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import type { RegistrosPage } from '../registros/registros.service.js';
import type { Proyeccion, Resumen } from './resumen.service.js';

// ConfigModule loads .env when AppModule is imported and caches the validated values.
const INGEST_KEY =
  process.env.INGEST_API_KEY ?? 'integration-test-key-0123456789abcdef0123';

interface Seed {
  id?: string;
  fecha: string;
  costo?: number;
  otros?: number;
  hora?: string | null;
  he?: [string, string, number] | null;
  workorder?: string | null;
  cliente?: string | null;
  review?: string | null;
  received?: string;
  origen?: string | null;
  origenCanon?: string | null;
  destino?: string | null;
  destinoCanon?: string | null;
}

describe.runIf(process.env.RUN_INTEGRATION === '1')('read API', () => {
  let app: INestApplication;
  let db: DataSource;
  let redis: Redis;
  let base: string;
  let cookie: string;
  let seq = 0;

  const get = async <T = Record<string, unknown>>(
    path: string,
    withCookie = true,
  ) => {
    const res = await fetch(`${base}${path}`, {
      headers: withCookie ? { cookie } : {},
    });
    return { status: res.status, body: (await res.json()) as T };
  };

  const seed = (r: Seed) =>
    db.query(
      `INSERT INTO movilidad_registros (
         gmail_message_id, received_at, fecha_form, periodo, costo_movilidad,
         otros_gastos, hora_inicio, he_inicio, he_fin, he_minutos, workorder,
         cliente, review_reason, parser_version, distrito_origen,
         distrito_origen_canon, distrito_destino, distrito_destino_canon,
         direccion_origen, direccion_destino)
       VALUES ($1, $2, $3, left($3, 7), $4, $5, $6, $7, $8, $9, $10, $11, $12,
               '2.0.0', $13, $14, $15, $16, 'DIRECCION PARTIDA', 'DIRECCION LLEGADA')`,
      [
        r.id ?? `seed${++seq}`,
        r.received ?? `${r.fecha}T12:00:00-05:00`,
        r.fecha,
        r.costo ?? 0,
        r.otros ?? 0,
        r.hora ?? null,
        r.he?.[0] ?? null,
        r.he?.[1] ?? null,
        r.he?.[2] ?? 0,
        r.workorder ?? null,
        r.cliente ?? null,
        r.review ?? null,
        r.origen ?? null,
        r.origenCanon ?? null,
        r.destino ?? null,
        r.destinoCanon ?? null,
      ],
    );

  const flushCache = async () => {
    const keys = await redis.keys('movilidad:v1:*');
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
    await db.query('TRUNCATE feriados');
    await db.query(`DELETE FROM config WHERE key = 'tarifa_hora_extra'`);
    await flushCache();
  });

  it.each(['/resumen', '/proyeccion', '/diario', '/registros'])(
    '%s answers 401 without a session',
    async (path) => {
      expect((await get(path, false)).status).toBe(401);
    },
  );

  it.each(['abc', '2026-13', '2026-1', '26-10'])(
    'rejects periodo "%s" with 400',
    async (periodo) => {
      for (const path of ['/resumen', '/proyeccion', '/diario', '/registros']) {
        expect((await get(`${path}?periodo=${periodo}`)).status).toBe(400);
      }
    },
  );

  describe('closed period (2025-03)', () => {
    beforeEach(async () => {
      await seed({
        fecha: '2025-03-05',
        costo: 30,
        otros: 6.5,
        workorder: 'W1',
        received: '2025-03-05T10:00:00-05:00',
      });
      await seed({
        fecha: '2025-03-05',
        costo: 20.4,
        he: ['17:00', '19:30', 150],
      });
      await seed({
        fecha: '2025-03-20',
        costo: 10,
        review: 'unknown_district',
        received: '2025-03-20T18:12:00-05:00',
      });
      await seed({
        fecha: '2025-03-21',
        costo: 0,
        otros: 0,
        review: 'no_amounts',
      });
      await seed({ fecha: '2025-04-01', costo: 99 }); // another period
    });

    it('GET /resumen sums the period only', async () => {
      const { status, body } = await get('/resumen?periodo=2025-03');
      expect(status).toBe(200);
      expect(body).toEqual({
        periodo: '2025-03',
        cerrado: true,
        total: 66.9,
        costo_movilidad: 60.4,
        otros_gastos: 6.5,
        registros: 4,
        por_revisar: 2,
        horas_extra_minutos: 150,
        horas_extra_monto: null,
        ultimo_registro_at: '2025-03-21T12:00:00-05:00',
        fecha_pago: '2025-04-15',
      });
    });

    it('GET /resumen computes the overtime amount when a rate is configured', async () => {
      await db.query(`INSERT INTO config VALUES ('tarifa_hora_extra', '10')`);
      expect(
        (await get<Resumen>('/resumen?periodo=2025-03')).body.horas_extra_monto,
      ).toBe(25);
    });

    it('GET /resumen uses the holiday table for the payday', async () => {
      await db.query(`INSERT INTO feriados VALUES ('2025-04-15', 'Test')`);
      expect(
        (await get<Resumen>('/resumen?periodo=2025-03')).body.fecha_pago,
      ).toBe('2025-04-16');
    });

    it('GET /diario groups by day with a running total', async () => {
      const { body } = await get('/diario?periodo=2025-03');
      expect(body).toEqual({
        periodo: '2025-03',
        items: [
          {
            fecha: '2025-03-05',
            costo_movilidad: 50.4,
            otros_gastos: 6.5,
            total: 56.9,
            registros: 2,
            acumulado: 56.9,
          },
          {
            fecha: '2025-03-20',
            costo_movilidad: 10,
            otros_gastos: 0,
            total: 10,
            registros: 1,
            acumulado: 66.9,
          },
          {
            fecha: '2025-03-21',
            costo_movilidad: 0,
            otros_gastos: 0,
            total: 0,
            registros: 1,
            acumulado: 66.9,
          },
        ],
      });
    });

    it('GET /proyeccion: proyectado equals acumulado and progress is 1', async () => {
      const { body } = await get('/proyeccion?periodo=2025-03');
      expect(body).toEqual({
        periodo: '2025-03',
        cerrado: true,
        acumulado: 66.9,
        promedio_diario: 33.45,
        dias_con_gasto: 2, // 2025-03-21 has a zero total
        dias_laborables_restantes: 0,
        proyectado: 66.9,
        muestra_insuficiente: true,
        progreso: 1,
        dias_transcurridos: 31,
        dias_del_mes: 31,
        fecha_pago: '2025-04-15',
        horas_extra_minutos: 150,
        horas_extra_monto: null,
      });
    });
  });

  it('answers an empty period with zeros and nulls', async () => {
    const resumen = (await get('/resumen?periodo=2025-01')).body;
    expect(resumen).toMatchObject({
      total: 0,
      registros: 0,
      por_revisar: 0,
      horas_extra_minutos: 0,
      ultimo_registro_at: null,
    });
    expect(
      (await get<{ items: unknown[] }>('/diario?periodo=2025-01')).body.items,
    ).toEqual([]);
    expect((await get('/registros?periodo=2025-01')).body).toEqual({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
    });
  });

  it('defaults to the current month and projects an open period', async () => {
    const today = todayIn('America/Lima');
    await seed({ fecha: today, costo: 12.34 });
    const resumen = (await get('/resumen')).body;
    expect(resumen).toMatchObject({
      periodo: today.slice(0, 7),
      cerrado: false,
      total: 12.34,
      registros: 1,
    });
    const proy = (await get<Proyeccion>('/proyeccion')).body;
    expect(proy).toMatchObject({
      cerrado: false,
      acumulado: 12.34,
      dias_con_gasto: 1,
      muestra_insuficiente: true,
      dias_transcurridos: Number(today.slice(8)),
    });
    expect(proy.proyectado).toBeGreaterThanOrEqual(12.34);
    expect(proy.progreso).toBeGreaterThan(0);
    expect(proy.progreso).toBeLessThanOrEqual(1);
  });

  describe('GET /registros', () => {
    beforeEach(async () => {
      await seed({
        fecha: '2025-03-05',
        hora: '15:00',
        costo: 29.9,
        otros: 6.5,
        workorder: 'W1',
        cliente: 'BCP',
        origen: 'Sjm',
        origenCanon: 'San Juan de Lurigancho',
        destino: 'Jesus Maria',
        destinoCanon: 'Jesús María',
      });
      await seed({
        fecha: '2025-03-05',
        hora: '18:40',
        costo: 10,
        workorder: 'W2',
        cliente: 'BCP',
        review: 'possible_duplicate',
      });
      await seed({
        fecha: '2025-03-05',
        hora: null,
        costo: 5,
        workorder: 'W3',
        cliente: 'OTRO',
      });
      await seed({
        fecha: '2025-03-10',
        hora: '08:00',
        costo: 7,
        he: ['17:00', '18:30', 90],
      });
      await seed({ fecha: '2025-04-02', costo: 1 });
    });

    it('returns the contract shape, newest day first, then latest start time, nulls last', async () => {
      const { body } = await get<RegistrosPage>('/registros?periodo=2025-03');
      expect(body.total).toBe(4);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(20);
      expect(body.items.map((i) => [i.fecha, i.hora_inicio])).toEqual([
        ['2025-03-10', '08:00'],
        ['2025-03-05', '18:40'],
        ['2025-03-05', '15:00'],
        ['2025-03-05', null],
      ]);
      expect(body.items[2]).toEqual({
        id: expect.any(Number),
        fecha: '2025-03-05',
        hora_inicio: '15:00',
        workorder: 'W1',
        cliente: 'BCP',
        desde: {
          distrito: 'Sjm',
          distrito_canon: 'San Juan de Lurigancho',
          direccion: 'DIRECCION PARTIDA',
        },
        hacia: {
          distrito: 'Jesus Maria',
          distrito_canon: 'Jesús María',
          direccion: 'DIRECCION LLEGADA',
        },
        costo_movilidad: 29.9,
        otros_gastos: 6.5,
        otros_detalle: null,
        total: 36.4,
        he_inicio: null,
        he_fin: null,
        he_minutos: 0,
        needs_review: false,
        review_reason: null,
      });
      expect(body.items[0]).toMatchObject({
        he_inicio: '17:00',
        he_fin: '18:30',
        he_minutos: 90,
      });
      expect(body.items[1]).toMatchObject({
        needs_review: true,
        review_reason: 'possible_duplicate',
      });
    });

    it('paginates and reports the number of matching rows', async () => {
      const p1 = (
        await get<RegistrosPage>('/registros?periodo=2025-03&limit=3&page=1')
      ).body;
      const p2 = (
        await get<RegistrosPage>('/registros?periodo=2025-03&limit=3&page=2')
      ).body;
      expect(p1.items).toHaveLength(3);
      expect(p2.items).toHaveLength(1);
      expect([p1.total, p2.total]).toEqual([4, 4]);
      expect(p2.page).toBe(2);
    });

    it('filters by cliente, workorder and por_revisar', async () => {
      expect(
        (await get('/registros?periodo=2025-03&cliente=OTRO')).body.total,
      ).toBe(1);
      expect(
        (await get<RegistrosPage>('/registros?periodo=2025-03&workorder=W2'))
          .body.items[0].workorder,
      ).toBe('W2');
      expect(
        (await get('/registros?periodo=2025-03&por_revisar=true')).body.total,
      ).toBe(1);
      expect(
        (await get('/registros?periodo=2025-03&por_revisar=false')).body.total,
      ).toBe(4);
    });

    it('supports desde/hasta, and periodo wins when both are sent', async () => {
      expect(
        (await get('/registros?desde=2025-03-05&hasta=2025-04-02')).body.total,
      ).toBe(5);
      expect(
        (
          await get(
            '/registros?periodo=2025-03&desde=2025-04-01&hasta=2025-04-30',
          )
        ).body.total,
      ).toBe(4);
    });

    it.each([
      'desde=2025-03-05',
      'desde=2025-03-31&hasta=2025-03-01',
      'desde=2025-02-30&hasta=2025-03-01',
      'limit=101',
      'limit=0',
      'page=0',
      'page=abc',
      'por_revisar=maybe',
    ])('rejects "%s" with 400', async (qs) => {
      expect((await get(`/registros?${qs}`)).status).toBe(400);
    });
  });

  describe('cache', () => {
    it('serves the cached response until an ingest invalidates the period', async () => {
      await seed({ fecha: '2025-03-05', costo: 10 });
      expect((await get('/resumen?periodo=2025-03')).body.registros).toBe(1);
      expect((await get('/registros?periodo=2025-03')).body.total).toBe(1);
      expect(await redis.exists('movilidad:v1:2025-03:resumen')).toBe(1);
      expect(await redis.exists('movilidad:v1:2025-03:registros:1:20')).toBe(1);

      // A row inserted behind the API's back is invisible while the cache holds.
      await seed({ fecha: '2025-03-06', costo: 5 });
      expect((await get('/resumen?periodo=2025-03')).body.registros).toBe(1);

      const ingest = await fetch(`${base}/ingest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': INGEST_KEY,
        },
        body: JSON.stringify({
          gmail_message_id: 'cache-test',
          received_at: '2025-03-07T10:00:00-05:00',
          fecha_form: '2025-03-07',
          costo_movilidad: 1,
          parser_version: '2.0.0',
        }),
      });
      expect(ingest.status).toBe(201);
      expect(await redis.keys('movilidad:v1:2025-03:*')).toEqual([]);

      expect((await get('/resumen?periodo=2025-03')).body.registros).toBe(3);
      expect((await get('/registros?periodo=2025-03')).body.total).toBe(3);
    });

    it('does not cache filtered listings', async () => {
      await seed({ fecha: '2025-03-05', costo: 10, cliente: 'BCP' });
      await get('/registros?periodo=2025-03&cliente=BCP');
      expect(await redis.keys('movilidad:v1:2025-03:registros:*')).toEqual([]);
    });

    it('keeps other periods cached when one is invalidated', async () => {
      await seed({ fecha: '2025-02-05', costo: 10 });
      await get('/resumen?periodo=2025-02');
      await fetch(`${base}/ingest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': INGEST_KEY,
        },
        body: JSON.stringify({
          gmail_message_id: 'cache-other',
          received_at: '2025-03-07T10:00:00-05:00',
          fecha_form: '2025-03-07',
          costo_movilidad: 1,
          parser_version: '2.0.0',
        }),
      });
      expect(await redis.exists('movilidad:v1:2025-02:resumen')).toBe(1);
    });
  });
});
