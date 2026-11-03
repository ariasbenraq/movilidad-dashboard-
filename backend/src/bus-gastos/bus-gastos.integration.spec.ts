// Needs a real Postgres and Redis. Run with RUN_INTEGRATION=1 and DB_*/REDIS_*
// pointing at a disposable database (the tables are dropped and recreated).
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { todayIn } from '../ingest/ingest.rules.js';
import { CreateMovilidadRegistros1761700000000 } from '../migrations/1761700000000-CreateMovilidadRegistros.js';
import { ParserV21761800000000 } from '../migrations/1761800000000-ParserV2.js';
import { CreateConfigFeriados1762000000000 } from '../migrations/1762000000000-CreateConfigFeriados.js';
import { CreateBusGastos1762100000000 } from '../migrations/1762100000000-CreateBusGastos.js';
import type { BusGastoItem } from './bus-gastos.service.js';

const valid = {
  fecha: '2025-03-05',
  desde: 'Sjm',
  hacia: 'Jesús María',
  costo: 3.5,
  duracion_min: 75,
  nota: null,
};

describe.runIf(process.env.RUN_INTEGRATION === '1')('bus expenses', () => {
  let app: INestApplication;
  let db: DataSource;
  let base: string;
  let cookie: string;

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
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
  };
  const list = (periodo = '2025-03') =>
    call<{ items: BusGastoItem[] }>('GET', `/bus-gastos?periodo=${periodo}`);
  const count = async () =>
    (
      await db.query<{ n: number }[]>(
        `SELECT COUNT(*)::int AS n FROM bus_gastos`,
      )
    )[0].n;

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
    cookie = `session=${await app.get(JwtService).signAsync({ username: 'renzo' })}`;

    for (const table of [
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
    await qr.release();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await db.query('TRUNCATE bus_gastos RESTART IDENTITY');
    await db.query('TRUNCATE movilidad_registros RESTART IDENTITY');
    await db.query('TRUNCATE distrito_equivalencias');
  });

  it.each([
    ['POST', '/bus-gastos'],
    ['GET', '/bus-gastos'],
    ['PUT', '/bus-gastos/1'],
    ['DELETE', '/bus-gastos/1'],
  ])('%s %s answers 401 without a session', async (method, path) => {
    expect((await fetch(`${base}${path}`, { method })).status).toBe(401);
  });

  describe('POST', () => {
    it('creates an expense and lists it in the contract shape', async () => {
      const created = await call('POST', '/bus-gastos', valid);
      expect(created.status).toBe(201);
      expect(created.body).toEqual({ id: 1 });

      const { status, body } = await list();
      expect(status).toBe(200);
      expect(body).toEqual({
        items: [
          {
            id: 1,
            fecha: '2025-03-05',
            desde: { distrito: 'Sjm', distrito_canon: null },
            hacia: { distrito: 'Jesús María', distrito_canon: null },
            costo: 3.5,
            duracion_min: 75,
            nota: null,
          },
        ],
      });
    });

    it('resolves the canonical districts through the equivalence table', async () => {
      await db.query(`INSERT INTO distrito_equivalencias VALUES
        ('sjm','San Juan de Lurigancho'), ('jesus maria','Jesús María')`);
      await call('POST', '/bus-gastos', {
        ...valid,
        desde: ' SJM ',
        hacia: 'Jesus  Maria',
      });
      const [item] = (await list()).body.items;
      expect(item.desde).toEqual({
        distrito: 'SJM',
        distrito_canon: 'San Juan de Lurigancho',
      });
      expect(item.hacia).toEqual({
        distrito: 'Jesus  Maria',
        distrito_canon: 'Jesús María',
      });
    });

    it('accepts the limits, a missing duration and a blank note', async () => {
      for (const over of [
        { costo: 0 },
        { costo: 500 },
        { duracion_min: 1 },
        { duracion_min: 600 },
        { duracion_min: null },
        { duracion_min: undefined, nota: '   ' },
      ]) {
        expect(
          (await call('POST', '/bus-gastos', { ...valid, ...over })).status,
        ).toBe(201);
      }
      const items = (await list()).body.items;
      expect(items).toHaveLength(6);
      expect(items.find((i) => i.costo === 0)).toBeDefined();
      expect(items.at(0)?.nota).toBeNull();
    });

    it.each([
      ['unknown field', { duracion: 75 }],
      ['costo as string', { costo: '3.5' }],
      ['costo over 500', { costo: 501 }],
      ['negative costo', { costo: -0.01 }],
      ['3 decimals', { costo: 3.123 }],
      ['missing costo', { costo: undefined }],
      ['duracion 0', { duracion_min: 0 }],
      ['duracion 601', { duracion_min: 601 }],
      ['fractional duracion', { duracion_min: 7.5 }],
      ['nota over 200', { nota: 'x'.repeat(201) }],
      ['missing desde', { desde: undefined }],
      ['blank hacia', { hacia: '  ' }],
      ['desde over 100', { desde: 'x'.repeat(101) }],
      ['impossible date', { fecha: '2025-02-30' }],
      ['date after tomorrow', { fecha: '2099-01-01' }],
      ['date before 2020', { fecha: '2019-12-31' }],
    ])('rejects %s with 400 and stores nothing', async (_name, over) => {
      const res = await call<{ message: unknown }>('POST', '/bus-gastos', {
        ...valid,
        ...over,
      });
      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(await count()).toBe(0);
    });
  });

  describe('GET', () => {
    it('lists the requested month, newest first', async () => {
      await call('POST', '/bus-gastos', {
        ...valid,
        fecha: '2025-03-05',
        costo: 1,
      });
      await call('POST', '/bus-gastos', {
        ...valid,
        fecha: '2025-03-20',
        costo: 2,
      });
      await call('POST', '/bus-gastos', {
        ...valid,
        fecha: '2025-03-20',
        costo: 3,
      });
      await call('POST', '/bus-gastos', {
        ...valid,
        fecha: '2025-04-01',
        costo: 4,
      });

      expect((await list('2025-03')).body.items.map((i) => i.costo)).toEqual([
        3, 2, 1,
      ]);
      expect((await list('2025-04')).body.items.map((i) => i.costo)).toEqual([
        4,
      ]);
      expect((await list('2025-05')).body).toEqual({ items: [] });
    });

    it('defaults to the current month', async () => {
      const today = todayIn('America/Lima');
      await call('POST', '/bus-gastos', { ...valid, fecha: today });
      await call('POST', '/bus-gastos', { ...valid, fecha: '2025-03-05' });
      const { body } = await call<{ items: BusGastoItem[] }>(
        'GET',
        '/bus-gastos',
      );
      expect(body.items.map((i) => i.fecha)).toEqual([today]);
    });

    it('rejects a malformed periodo', async () => {
      expect((await call('GET', '/bus-gastos?periodo=2025-13')).status).toBe(
        400,
      );
    });
  });

  describe('PUT', () => {
    it('replaces the expense and returns it, re-resolving the canon', async () => {
      await db.query(
        `INSERT INTO distrito_equivalencias VALUES ('surco','Santiago de Surco')`,
      );
      await call('POST', '/bus-gastos', valid);
      const put = await call<BusGastoItem>('PUT', '/bus-gastos/1', {
        fecha: '2025-03-06',
        desde: 'Surco',
        hacia: 'Barranco',
        costo: 4,
        nota: 'ida',
      });
      expect(put.status).toBe(200);
      expect(put.body).toEqual({
        id: 1,
        fecha: '2025-03-06',
        desde: { distrito: 'Surco', distrito_canon: 'Santiago de Surco' },
        hacia: { distrito: 'Barranco', distrito_canon: null },
        costo: 4,
        duracion_min: null,
        nota: 'ida',
      });
      expect((await list()).body.items).toEqual([put.body]);
    });

    it('answers 404 for a missing or impossible id and 400 for a malformed one', async () => {
      expect((await call('PUT', '/bus-gastos/99', valid)).status).toBe(404);
      expect(
        (await call('PUT', '/bus-gastos/99999999999999999999', valid)).status,
      ).toBe(404);
      expect((await call('PUT', '/bus-gastos/abc', valid)).status).toBe(400);
    });

    it('rejects an invalid body and leaves the expense unchanged', async () => {
      await call('POST', '/bus-gastos', valid);
      expect(
        (await call('PUT', '/bus-gastos/1', { ...valid, costo: 501 })).status,
      ).toBe(400);
      expect(
        (await call('PUT', '/bus-gastos/1', { ...valid, extra: 1 })).status,
      ).toBe(400);
      expect((await list()).body.items[0].costo).toBe(3.5);
    });
  });

  describe('DELETE', () => {
    it('removes the expense, then answers 404', async () => {
      await call('POST', '/bus-gastos', valid);
      expect((await call('DELETE', '/bus-gastos/1')).status).toBe(204);
      expect(await count()).toBe(0);
      expect((await call('DELETE', '/bus-gastos/1')).status).toBe(404);
      expect((await call('DELETE', '/bus-gastos/abc')).status).toBe(400);
      expect(
        (await call('DELETE', '/bus-gastos/99999999999999999999')).status,
      ).toBe(404);
    });
  });

  it('never changes the taxi totals', async () => {
    await call('POST', '/bus-gastos', { ...valid, costo: 400 });
    const resumen = await call('GET', '/resumen?periodo=2025-03');
    expect(resumen.body).toMatchObject({
      total: 0,
      costo_movilidad: 0,
      registros: 0,
    });
    const proyeccion = await call('GET', '/proyeccion?periodo=2025-03');
    expect(proyeccion.body).toMatchObject({ acumulado: 0, dias_con_gasto: 0 });
  });

  it('follows equivalence changes: a new mapping fills the canon, a removal clears it', async () => {
    await call('POST', '/bus-gastos', valid);
    expect((await list()).body.items[0].desde.distrito_canon).toBeNull();

    await call('PUT', '/distritos/equivalencias', {
      texto: 'SJM',
      distrito: 'San Juan de Lurigancho',
    });
    await call('PUT', '/distritos/equivalencias', {
      texto: 'jesus maria',
      distrito: 'Jesús María',
    });
    let [item] = (await list()).body.items;
    expect(item.desde.distrito_canon).toBe('San Juan de Lurigancho');
    expect(item.hacia.distrito_canon).toBe('Jesús María');

    await call('DELETE', '/distritos/equivalencias/sjm');
    [item] = (await list()).body.items;
    expect(item.desde).toEqual({ distrito: 'Sjm', distrito_canon: null });
    expect(item.hacia.distrito_canon).toBe('Jesús María');
  });
});
