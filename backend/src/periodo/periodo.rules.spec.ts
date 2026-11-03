import {
  DEFAULT_CONFIG,
  diasDelMes,
  diasLaborablesRestantes,
  diasTranscurridos,
  esCerrado,
  fechaPago,
  horasExtraMonto,
  parseConfig,
  proyectar,
  siguientePeriodo,
  toIsoInZone,
  ultimoDia,
} from './periodo.rules.js';

const none = new Set<string>();

describe('calendar helpers', () => {
  it('knows month lengths, including leap years and year end', () => {
    expect(diasDelMes('2026-02')).toBe(28);
    expect(diasDelMes('2028-02')).toBe(29);
    expect(ultimoDia('2026-10')).toBe('2026-10-31');
    expect(siguientePeriodo('2026-12')).toBe('2027-01');
    expect(siguientePeriodo('2026-10')).toBe('2026-11');
  });
  it('closes a period the day after its last day', () => {
    expect(esCerrado('2026-10', '2026-10-31')).toBe(false);
    expect(esCerrado('2026-10', '2026-11-01')).toBe(true);
  });
  it('counts elapsed days', () => {
    expect(diasTranscurridos('2026-10', '2026-10-29')).toBe(29);
    expect(diasTranscurridos('2026-10', '2026-11-20')).toBe(31);
    expect(diasTranscurridos('2026-12', '2026-11-20')).toBe(0);
  });
});

describe('fechaPago', () => {
  it('moves a Sunday 15th to the next business day', () => {
    expect(fechaPago('2026-10', DEFAULT_CONFIG, none)).toBe('2026-11-16');
  });
  it('keeps a weekday 15th', () => {
    expect(fechaPago('2025-03', DEFAULT_CONFIG, none)).toBe('2025-04-15');
  });
  it('skips a holiday after the weekend', () => {
    expect(fechaPago('2026-10', DEFAULT_CONFIG, new Set(['2026-11-16']))).toBe(
      '2026-11-17',
    );
  });
  it('moves back when configured as previous', () => {
    const previous = {
      ...DEFAULT_CONFIG,
      pagoFinDeSemana: 'previous' as const,
    };
    expect(fechaPago('2026-10', previous, none)).toBe('2026-11-13');
  });
  it('rolls over the year', () => {
    expect(fechaPago('2026-12', DEFAULT_CONFIG, none)).toBe('2027-01-15');
  });
});

describe('diasLaborablesRestantes', () => {
  it('counts Monday to Saturday after today', () => {
    // Thu 29 Oct 2026: Fri 30 and Sat 31 remain.
    expect(
      diasLaborablesRestantes('2026-10', '2026-10-29', DEFAULT_CONFIG, none),
    ).toBe(2);
  });
  it('excludes today, Sundays and holidays', () => {
    expect(
      diasLaborablesRestantes('2026-10', '2026-10-30', DEFAULT_CONFIG, none),
    ).toBe(1);
    expect(
      diasLaborablesRestantes(
        '2026-10',
        '2026-10-29',
        DEFAULT_CONFIG,
        new Set(['2026-10-30']),
      ),
    ).toBe(1);
    // Fri 30 Oct, Sat 31 Oct, then Sunday 1 Nov is outside the period anyway.
    expect(
      diasLaborablesRestantes('2026-10', '2026-10-31', DEFAULT_CONFIG, none),
    ).toBe(0);
  });
  it('is zero for a closed period and the full month for a future one', () => {
    expect(
      diasLaborablesRestantes('2026-10', '2026-11-05', DEFAULT_CONFIG, none),
    ).toBe(0);
    // Dec 2026 has 31 days, 4 Sundays (6, 13, 20, 27).
    expect(
      diasLaborablesRestantes('2026-12', '2026-11-05', DEFAULT_CONFIG, none),
    ).toBe(27);
  });
});

describe('proyectar', () => {
  it('projects accumulated plus average times remaining days, rounding once', () => {
    const p = proyectar({
      acumuladoCents: 41230,
      diasConGasto: 21,
      diasLaborablesRestantes: 2,
      cerrado: false,
    });
    expect(p.acumulado).toBe(412.3);
    expect(p.promedio_diario).toBe(19.63);
    expect(p.proyectado).toBe(451.57);
    expect(p.progreso).toBe(0.91);
    expect(p.muestra_insuficiente).toBe(false);
  });
  it('flags a sample under 3 days', () => {
    expect(
      proyectar({
        acumuladoCents: 3000,
        diasConGasto: 2,
        diasLaborablesRestantes: 5,
        cerrado: false,
      }).muestra_insuficiente,
    ).toBe(true);
  });
  it('closed period: proyectado = acumulado, no remaining days, progress 1', () => {
    const p = proyectar({
      acumuladoCents: 41230,
      diasConGasto: 21,
      diasLaborablesRestantes: 9,
      cerrado: true,
    });
    expect(p).toMatchObject({
      proyectado: 412.3,
      dias_laborables_restantes: 0,
      progreso: 1,
    });
  });
  it('handles an empty period', () => {
    const open = proyectar({
      acumuladoCents: 0,
      diasConGasto: 0,
      diasLaborablesRestantes: 5,
      cerrado: false,
    });
    expect(open).toMatchObject({
      promedio_diario: 0,
      proyectado: 0,
      progreso: 0,
    });
    const closed = proyectar({
      acumuladoCents: 0,
      diasConGasto: 0,
      diasLaborablesRestantes: 0,
      cerrado: true,
    });
    expect(closed.progreso).toBe(1);
  });
});

describe('horasExtraMonto', () => {
  it('is null without a rate', () => {
    expect(horasExtraMonto(150, null)).toBeNull();
  });
  it('is minutes over 60 times the rate, rounded once', () => {
    expect(horasExtraMonto(150, 10)).toBe(25);
    expect(horasExtraMonto(100, 7.5)).toBe(12.5);
  });
});

describe('parseConfig', () => {
  it('uses defaults for an empty table', () => {
    expect(parseConfig([])).toEqual(DEFAULT_CONFIG);
  });
  it('reads valid values', () => {
    const c = parseConfig([
      { key: 'dias_laborables', value: '1,2,3,4,5' },
      { key: 'pago_dia', value: '20' },
      { key: 'pago_fin_de_semana', value: 'previous' },
      { key: 'tarifa_hora_extra', value: '12.5' },
    ]);
    expect(c).toMatchObject({
      diasLaborables: [1, 2, 3, 4, 5],
      pagoDia: 20,
      pagoFinDeSemana: 'previous',
      tarifaHoraExtra: 12.5,
    });
  });
  it('ignores invalid values', () => {
    const c = parseConfig([
      { key: 'dias_laborables', value: '1,9' },
      { key: 'pago_dia', value: '40' },
      { key: 'pago_fin_de_semana', value: 'later' },
      { key: 'tarifa_hora_extra', value: 'abc' },
    ]);
    expect(c).toEqual(DEFAULT_CONFIG);
  });
});

describe('toIsoInZone', () => {
  it('formats with the zone offset', () => {
    expect(toIsoInZone(new Date('2026-10-29T23:12:00Z'), 'America/Lima')).toBe(
      '2026-10-29T18:12:00-05:00',
    );
  });
  it('rolls the date back across midnight', () => {
    expect(toIsoInZone(new Date('2026-10-30T02:00:00Z'), 'America/Lima')).toBe(
      '2026-10-29T21:00:00-05:00',
    );
  });
});
