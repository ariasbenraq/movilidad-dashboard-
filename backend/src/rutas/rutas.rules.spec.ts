import {
  distanciaKm,
  duracionTaxiMin,
  hashDireccion,
  mesesBase,
  presupuestar,
} from './rutas.rules.js';

describe('hashDireccion', () => {
  it('is a SHA-256 hex digest', () => {
    expect(hashDireccion('Av. Siempre Viva 123')).toMatch(/^[0-9a-f]{64}$/);
  });
  it('ignores case, accents and repeated spaces', () => {
    expect(hashDireccion('  Av.  Perú 123 ')).toBe(
      hashDireccion('av. peru 123'),
    );
  });
  it('tells different addresses apart', () => {
    expect(hashDireccion('Av. Perú 123')).not.toBe(
      hashDireccion('Av. Perú 124'),
    );
  });
});

describe('mesesBase', () => {
  const history = '2025-01';
  it('takes the last closed months before the budgeted one', () => {
    // 29 Oct: October is still open, so the base is Jul-Sep.
    expect(mesesBase('2026-11', '2026-10-29', 3, history)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    // From 1 Nov, October counts.
    expect(mesesBase('2026-11', '2026-11-02', 3, history)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });
  it('crosses the year boundary', () => {
    expect(mesesBase('2026-02', '2026-02-10', 3, history)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });
  it('only goes back as far as the first stored month', () => {
    expect(mesesBase('2026-11', '2026-11-02', 3, '2026-09')).toEqual([
      '2026-09',
      '2026-10',
    ]);
  });
  it('is empty without history or when nothing is closed yet', () => {
    expect(mesesBase('2026-11', '2026-11-02', 3, null)).toEqual([]);
    expect(mesesBase('2026-11', '2026-10-15', 3, '2026-10')).toEqual([]);
  });
  it('keeps the same closed months for a far future period', () => {
    expect(mesesBase('2027-03', '2026-10-29', 3, history)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
  });
});

describe('route figures', () => {
  it('converts meters to km with one decimal', () => {
    expect(distanciaKm(18_449)).toBe(18.4);
    expect(distanciaKm(18_450)).toBe(18.5);
  });
  it('applies the traffic factor to the provider time, in minutes', () => {
    expect(duracionTaxiMin(2400, 1.3)).toBe(52); // 40 min x 1.3
    expect(duracionTaxiMin(2400, 1)).toBe(40);
  });
});

describe('presupuestar', () => {
  const sjlJm = {
    desde: 'San Juan de Lurigancho',
    hacia: 'Jesús María',
    viajes: 27,
    costoCents: 27 * 2390,
    duracionMin: 52,
  };
  const bus = {
    desde: 'San Juan de Lurigancho',
    hacia: 'Jesús María',
    entradas: 2,
    costoCents: 700,
    duracionMin: 75,
  };

  it('matches the contract example for a route with bus data', () => {
    const r = presupuestar([sjlJm], [bus], 3);
    expect(r.rutas).toEqual([
      {
        desde: 'San Juan de Lurigancho',
        hacia: 'Jesús María',
        viajes_esperados: 9,
        taxi: { costo_promedio: 23.9, costo_total: 215.1, duracion_min: 52 },
        bus: { costo_promedio: 3.5, costo_total: 31.5, duracion_min: 75 },
      },
    ]);
    expect(r.taxi).toEqual({
      total: 215.1,
      minutos: 9 * 52,
      incompleto: false,
    });
    expect(r.bus).toEqual({ total: 31.5, minutos: 9 * 75, incompleto: false });
    expect(r.diferencia_costo).toBe(183.6);
  });

  it('is negative when the bus costs more', () => {
    const caro = { ...bus, costoCents: 2 * 5000 };
    expect(presupuestar([sjlJm], [caro], 3).diferencia_costo).toBe(215.1 - 450);
  });

  it('marks the bus total incomplete and hides the difference for a route without bus data', () => {
    const otra = {
      desde: 'Surco',
      hacia: 'Ate',
      viajes: 6,
      costoCents: 6 * 1000,
      duracionMin: 20,
    };
    const r = presupuestar([sjlJm, otra], [bus], 3);
    expect(r.rutas.find((x) => x.desde === 'Surco')?.bus).toBeNull();
    expect(r.bus.total).toBe(31.5); // only the route that has data
    expect(r.bus.incompleto).toBe(true);
    expect(r.diferencia_costo).toBeNull();
    expect(r.taxi.total).toBe(215.1 + 2 * 10);
  });

  it('marks taxi minutes incomplete while a route has no duration', () => {
    const r = presupuestar([{ ...sjlJm, duracionMin: null }], [bus], 3);
    expect(r.taxi).toEqual({ total: 215.1, minutos: 0, incompleto: true });
    expect(r.rutas[0].taxi.duracion_min).toBeNull();
  });

  it('keeps null bus duration when the entries have none', () => {
    const r = presupuestar([sjlJm], [{ ...bus, duracionMin: null }], 3);
    expect(r.rutas[0].bus?.duracion_min).toBeNull();
    expect(r.bus.minutos).toBe(0);
    expect(r.bus.incompleto).toBe(false);
  });

  it('rounds expected trips to the nearest integer and drops routes under half a trip', () => {
    const route = (viajes: number) => ({
      desde: 'A',
      hacia: 'B',
      viajes,
      costoCents: viajes * 1000,
      duracionMin: 10,
    });
    expect(presupuestar([route(4)], [], 3).rutas[0].viajes_esperados).toBe(1); // 1.33
    expect(presupuestar([route(5)], [], 3).rutas[0].viajes_esperados).toBe(2); // 1.67
    expect(presupuestar([route(3)], [], 2).rutas[0].viajes_esperados).toBe(2); // 1.5
    expect(presupuestar([route(1)], [], 3).rutas).toEqual([]); // 0.33
  });

  it('sorts by expected trips and handles no routes or no base months', () => {
    const a = {
      desde: 'A',
      hacia: 'B',
      viajes: 3,
      costoCents: 300,
      duracionMin: 5,
    };
    const b = {
      desde: 'C',
      hacia: 'D',
      viajes: 9,
      costoCents: 900,
      duracionMin: 5,
    };
    expect(presupuestar([a, b], [], 3).rutas.map((r) => r.desde)).toEqual([
      'C',
      'A',
    ]);
    expect(presupuestar([], [], 3)).toMatchObject({
      taxi: { total: 0, minutos: 0, incompleto: false },
      bus: { total: 0, incompleto: false },
      diferencia_costo: 0,
      rutas: [],
    });
    expect(presupuestar([a], [], 0).rutas).toEqual([]);
  });

  it('sums money in integer cents', () => {
    const r = presupuestar(
      [
        {
          desde: 'A',
          hacia: 'B',
          viajes: 3,
          costoCents: 21,
          duracionMin: null,
        },
      ],
      [],
      1,
    );
    expect(r.rutas[0].taxi.costo_promedio).toBe(0.07);
    expect(r.taxi.total).toBe(0.21); // 3 * 0.07 is 0.21000000000000002 in floats
  });
});
