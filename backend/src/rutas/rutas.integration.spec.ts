// Needs a real Postgres and Redis. Run with RUN_INTEGRATION=1 and DB_*/REDIS_*
// pointing at a disposable database (the tables are dropped and recreated).
// OpenRouteService is replaced by a fake: no network, no API key.
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
import { CreateBusGastos1762100000000 } from '../migrations/1762100000000-CreateBusGastos.js';
import { CreateRutasCache1762200000000 } from '../migrations/1762200000000-CreateRutasCache.js';
import { siguientePeriodo } from '../periodo/periodo.rules.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import {
  ROUTING_DELAY_MS,
  ROUTING_PROVIDER,
  type RutaCalculada,
} from './routing.provider.js';
import { RutasRoutingService } from './rutas-routing.service.js';
import type { Presupuesto, RutaItem } from './rutas.service.js';

const SJL = 'San Juan de Lurigancho';
const JM = 'Jesús María';
const SURCO = 'Santiago de Surco';
const ATE = 'Ate';

interface Seed {
  fecha: string;
  costo: number;
  desde?: string | null;
  hacia?: string | null;
  dirOrigen?: string | null;
  dirDestino?: string | null;
}

describe.runIf(process.env.RUN_INTEGRATION === '1')('routes and budget', () => {
  let app: INestApplication;
  let db: DataSource;
  let redis: Redis;
  let routing: RutasRoutingService;
  let base: string;
  let cookie: string;
  let seq = 0;

  const fake = {
    enabled: true,
    calls: [] as [string, string][],
    failWith: null as Error | null,
    result: {
      distancia_m: 18_400,
      duracion_s: 2400,
      geocode_confianza: 0.82,
    } as RutaCalculada | null,
    async ruta(origen: string, destino: string) {
      fake.calls.push([origen, destino]);
      if (fake.failWith) throw fake.failWith;
      return fake.result;
    },
  };

  const call = async <T = Record<string, unknown>>(
    path: string,
    withCookie = true,
  ) => {
    const res = await fetch(`${base}${path}`, {
      headers: withCookie ? { cookie } : {},
    });
    return { status: res.status, body: (await res.json()) as T };
  };
  const rutas = (periodo: string) =>
    call<{ periodo: string; items: RutaItem[] }>(
      `/analitica/rutas?periodo=${periodo}`,
    );
  const presupuesto = (periodo: string) =>
    call<Presupuesto>(`/presupuesto?periodo=${periodo}`);

  const seed = (r: Seed) =>
    db.query(
      `INSERT INTO movilidad_registros (
         gmail_message_id, received_at, fecha_form, periodo, costo_movilidad,
         parser_version, distrito_origen_canon, distrito_destino_canon,
         direccion_origen, direccion_destino)
       VALUES ($1, now(), $2, $8, $3, '2.0.0', $4, $5, $6, $7)`,
      [
        `seed${++seq}`,
        r.fecha,
        r.costo,
        r.desde ?? null,
        r.hacia ?? null,
        r.dirOrigen ?? null,
        r.dirDestino ?? null,
        r.fecha.slice(0, 7),
      ],
    );
  const seedBus = (
    fecha: string,
    desde: string,
    hacia: string,
    costo: number,
    duracion: number | null,
  ) =>
    db.query(
      `INSERT INTO bus_gastos (fecha, distrito_origen, distrito_destino,
         distrito_origen_canon, distrito_destino_canon, costo, duracion_min)
       VALUES ($1, $2, $3, $2, $3, $4, $5)`,
      [fecha, desde, hacia, costo, duracion],
    );

  /** Q4 2025: SJL->JM 2+3+4 trips, JM->SJL 1 a month, Surco->Ate once, one unmapped. */
  const seedHistory = async () => {
    const trips = (fecha: string, n: number, extra: Partial<Seed>) =>
      Promise.all(
        Array.from({ length: n }, () => seed({ fecha, costo: 20, ...extra })),
      );
    const main = {
      desde: SJL,
      hacia: JM,
      dirOrigen: 'Av. Privada 100',
      dirDestino: 'Jr. Secreto 200',
    };
    await trips('2025-10-05', 2, main);
    await trips('2025-11-05', 3, main);
    await trips('2025-12-05', 3, main);
    // The less frequent address pair must lose against the main one.
    await trips('2025-12-06', 1, {
      ...main,
      dirOrigen: 'Av. Otra 999',
      dirDestino: 'Jr. Otro 888',
    });
    for (const fecha of ['2025-10-07', '2025-11-07', '2025-12-07']) {
      await trips(fecha, 1, {
        costo: 25,
        desde: JM,
        hacia: SJL,
        dirOrigen: 'Jr. Secreto 200',
        dirDestino: 'Av. Privada 100',
      });
    }
    await trips('2025-12-08', 1, {
      costo: 10,
      desde: SURCO,
      hacia: ATE,
      dirOrigen: 'Calle Sur 1',
      dirDestino: 'Calle Este 2',
    });
    await trips('2025-12-09', 1, {
      costo: 7,
      desde: null,
      hacia: JM,
      dirOrigen: 'Sin mapear 1',
      dirDestino: 'Jr. Secreto 200',
    });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ROUTING_PROVIDER)
      .useValue(fake)
      .overrideProvider(ROUTING_DELAY_MS)
      .useValue(0)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    db = app.get(getDataSourceToken());
    redis = app.get(REDIS_CLIENT);
    routing = app.get(RutasRoutingService);
    cookie = `session=${await app.get(JwtService).signAsync({ username: 'renzo' })}`;

    for (const table of [
      'rutas_cache',
      'bus_gastos',
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
    await new CreateBusGastos1762100000000().up(qr);
    await new CreateRutasCache1762200000000().up(qr);
    await qr.release();
  });

  afterAll(async () => {
    await app?.close();
  });

  // A test may leave routes computing in the background; let them finish first.
  afterEach(async () => {
    await routing.idle();
  });

  beforeEach(async () => {
    for (const table of ['rutas_cache', 'bus_gastos', 'movilidad_registros']) {
      await db.query(`TRUNCATE ${table} RESTART IDENTITY`);
    }
    await db.query(
      `UPDATE config SET value = '1.3' WHERE key = 'factor_trafico'`,
    );
    const keys = await redis.keys('movilidad:ors:fail:*');
    if (keys.length) await redis.del(...keys);
    fake.enabled = true;
    fake.calls = [];
    fake.failWith = null;
    fake.result = {
      distancia_m: 18_400,
      duracion_s: 2400,
      geocode_confianza: 0.82,
    };
  });

  it.each(['/analitica/rutas', '/presupuesto'])(
    '%s answers 401 without a session',
    async (path) => {
      expect((await call(path, false)).status).toBe(401);
    },
  );

  it.each(['abc', '2026-13'])(
    'rejects periodo "%s" with 400',
    async (periodo) => {
      expect((await rutas(periodo)).status).toBe(400);
      expect((await presupuesto(periodo)).status).toBe(400);
    },
  );

  describe('GET /analitica/rutas', () => {
    it('lists the canonical routes of the month, busiest first, with null figures until computed', async () => {
      await seedHistory();
      const first = await rutas('2025-12');
      expect(first.status).toBe(200);
      expect(first.body.periodo).toBe('2025-12');
      // Unmapped records form no route; ties are alphabetical.
      expect(first.body.items.map((i) => [i.desde, i.hacia, i.viajes])).toEqual(
        [
          [SJL, JM, 4],
          [JM, SJL, 1],
          [SURCO, ATE, 1],
        ],
      );
      expect(first.body.items[0]).toMatchObject({
        costo_promedio: 20,
        costo_total: 80,
      });
      expect(first.body.items[1]).toMatchObject({
        costo_promedio: 25,
        costo_total: 25,
      });
    });

    it('computes the routes in the background from the most frequent address pair, then serves them from the cache', async () => {
      await seedHistory();
      await rutas('2025-12');

      await vi.waitFor(async () => {
        const { body } = await rutas('2025-12');
        expect(body.items.every((i) => i.distancia_km !== null)).toBe(true);
      });
      const { body } = await rutas('2025-12');
      expect(body.items[0]).toMatchObject({
        distancia_km: 18.4,
        duracion_taxi_min: 52, // 2400 s = 40 min x 1.3
        geocode_confianza: 0.82,
      });

      // One call per route, with the dominant address pair plus the district.
      expect(fake.calls).toHaveLength(3);
      expect(fake.calls).toContainEqual([
        'Av. Privada 100, San Juan de Lurigancho, Peru',
        'Jr. Secreto 200, Jesús María, Peru',
      ]);
      expect(fake.calls.flat().join(' ')).not.toContain('Otra 999');

      // Cached: more requests do not call the provider again.
      await rutas('2025-12');
      await rutas('2025-12');
      expect(fake.calls).toHaveLength(3);
    });

    it('stores only hashes in rutas_cache', async () => {
      await seedHistory();
      await rutas('2025-12');
      await vi.waitFor(async () => {
        const n = await db.query<{ n: number }[]>(
          `SELECT COUNT(*)::int AS n FROM rutas_cache`,
        );
        expect(n[0].n).toBe(3);
      });
      const rows = await db.query<Record<string, unknown>[]>(
        `SELECT * FROM rutas_cache`,
      );
      expect(Object.keys(rows[0]).sort()).toEqual([
        'destino_hash',
        'distancia_m',
        'duracion_s',
        'fetched_at',
        'geocode_confianza',
        'origen_hash',
      ]);
      expect(JSON.stringify(rows)).not.toMatch(/Privada|Secreto|Sur 1/);
      expect(rows[0].origen_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('applies the traffic factor from config without calling the provider again', async () => {
      await seedHistory();
      await rutas('2025-12');
      await vi.waitFor(async () => {
        expect((await rutas('2025-12')).body.items[0].distancia_km).toBe(18.4);
      });
      await db.query(
        `UPDATE config SET value = '2' WHERE key = 'factor_trafico'`,
      );
      expect((await rutas('2025-12')).body.items[0].duracion_taxi_min).toBe(80);
      expect(fake.calls).toHaveLength(3);
    });

    it('reports a low geocoding confidence instead of hiding it', async () => {
      fake.result = {
        distancia_m: 5000,
        duracion_s: 600,
        geocode_confianza: 0.31,
      };
      await seedHistory();
      await rutas('2025-12');
      await vi.waitFor(async () => {
        expect((await rutas('2025-12')).body.items[0].geocode_confianza).toBe(
          0.31,
        );
      });
    });

    it('keeps the figures null when the provider fails, and does not retry at once', async () => {
      fake.failWith = new Error('OpenRouteService answered 429');
      await seedHistory();
      await rutas('2025-12');
      await vi.waitFor(() =>
        expect(fake.calls.length).toBeGreaterThanOrEqual(3),
      );
      const after = await rutas('2025-12');
      expect(after.status).toBe(200);
      expect(after.body.items.every((i) => i.distancia_km === null)).toBe(true);
      const calls = fake.calls.length;
      await rutas('2025-12');
      await new Promise((r) => setTimeout(r, 100));
      expect(fake.calls).toHaveLength(calls);
    });

    it('does not call the provider when it has no key', async () => {
      fake.enabled = false;
      await seedHistory();
      const { body } = await rutas('2025-12');
      expect(body.items.every((i) => i.distancia_km === null)).toBe(true);
      expect(fake.calls).toHaveLength(0);
    });

    it('never returns addresses', async () => {
      await seedHistory();
      const { body } = await rutas('2025-12');
      expect(JSON.stringify(body)).not.toMatch(/Privada|Secreto|direccion/i);
    });

    it('answers an empty month with no items', async () => {
      expect((await rutas('2025-08')).body).toEqual({
        periodo: '2025-08',
        items: [],
      });
    });
  });

  describe('GET /presupuesto', () => {
    // 2026-01 is budgeted from the last 3 closed months: Oct, Nov, Dec 2025.
    it('averages the base months per route and combines taxi with bus history', async () => {
      await seedHistory();
      await seedBus('2025-06-10', SJL, JM, 3, 70);
      await seedBus('2025-12-20', SJL, JM, 4, 80);
      await seedBus('2026-01-15', SJL, JM, 100, 10); // not before the budgeted month: ignored

      const first = (await presupuesto('2026-01')).body;
      expect(first.periodo).toBe('2026-01');
      expect(first.base_meses).toEqual(['2025-10', '2025-11', '2025-12']);
      // Durations are unknown until the background job finishes.
      expect(first.taxi.incompleto).toBe(true);

      await vi.waitFor(async () => {
        expect((await presupuesto('2026-01')).body.taxi.incompleto).toBe(false);
      });
      const { body } = await presupuesto('2026-01');
      expect(body.rutas).toEqual([
        {
          desde: SJL,
          hacia: JM,
          viajes_esperados: 3, // 9 trips / 3 months
          taxi: { costo_promedio: 20, costo_total: 60, duracion_min: 52 },
          bus: { costo_promedio: 3.5, costo_total: 10.5, duracion_min: 75 },
        },
        {
          desde: JM,
          hacia: SJL,
          viajes_esperados: 1,
          taxi: { costo_promedio: 25, costo_total: 25, duracion_min: 52 },
          bus: null,
        },
      ]); // Surco -> Ate: 1 trip in 3 months rounds to 0 and is left out
      expect(body.taxi).toEqual({
        total: 85,
        minutos: 4 * 52,
        incompleto: false,
      });
      expect(body.bus).toEqual({
        total: 10.5,
        minutos: 3 * 75,
        incompleto: true,
      });
      expect(body.diferencia_costo).toBeNull();
    });

    it('gives the cost difference once every route has bus data', async () => {
      await seedHistory();
      await seedBus('2025-06-10', SJL, JM, 3, 70);
      await seedBus('2025-12-20', SJL, JM, 4, 80);
      await seedBus('2025-11-02', JM, SJL, 2, null);
      const { body } = await presupuesto('2026-01');
      expect(body.bus).toEqual({
        total: 12.5,
        minutos: 3 * 75,
        incompleto: false,
      });
      expect(body.rutas[1].bus).toEqual({
        costo_promedio: 2,
        costo_total: 2,
        duracion_min: null,
      });
      expect(body.diferencia_costo).toBe(72.5); // 85 - 12.5
    });

    it('is negative when the bus costs more than the taxi', async () => {
      await seedHistory();
      await seedBus('2025-06-10', SJL, JM, 50, null);
      await seedBus('2025-06-11', JM, SJL, 60, null);
      expect((await presupuesto('2026-01')).body.diferencia_costo).toBe(
        85 - (3 * 50 + 60),
      );
    });

    it('does not mix the bus data into the taxi totals', async () => {
      await seedHistory();
      await seedBus('2025-11-02', SJL, JM, 400, 60);
      expect((await presupuesto('2026-01')).body.taxi.total).toBe(85);
    });

    it('only goes back to the month of the first record', async () => {
      await seed({
        fecha: '2025-12-05',
        costo: 20,
        desde: SJL,
        hacia: JM,
        dirOrigen: 'Av. Privada 100',
        dirDestino: 'Jr. Secreto 200',
      });
      await seed({
        fecha: '2025-12-06',
        costo: 20,
        desde: SJL,
        hacia: JM,
        dirOrigen: 'Av. Privada 100',
        dirDestino: 'Jr. Secreto 200',
      });
      const { body } = await presupuesto('2026-01');
      expect(body.base_meses).toEqual(['2025-12']);
      expect(body.rutas[0].viajes_esperados).toBe(2);
    });

    it('answers an empty budget with no history', async () => {
      const { status, body } = await presupuesto('2026-01');
      expect(status).toBe(200);
      expect(body).toMatchObject({
        base_meses: [],
        taxi: { total: 0, minutos: 0, incompleto: false },
        bus: { total: 0, minutos: 0, incompleto: false },
        diferencia_costo: 0,
        rutas: [],
      });
    });

    it('budgets next month by default', async () => {
      const next = siguientePeriodo(todayIn('America/Lima').slice(0, 7));
      expect((await call<Presupuesto>('/presupuesto')).body.periodo).toBe(next);
    });

    it('uses presupuesto_meses from config', async () => {
      await seedHistory();
      await db.query(
        `UPDATE config SET value = '2' WHERE key = 'presupuesto_meses'`,
      );
      try {
        expect((await presupuesto('2026-01')).body.base_meses).toEqual([
          '2025-11',
          '2025-12',
        ]);
      } finally {
        await db.query(
          `UPDATE config SET value = '3' WHERE key = 'presupuesto_meses'`,
        );
      }
    });
  });
});
