import {
  addDays,
  heMinutos,
  isValidFechaForm,
  periodoOf,
  reviewReason,
  todayIn,
} from './ingest.rules.js';

describe('periodoOf', () => {
  it('takes the month of fecha_form', () => {
    expect(periodoOf('2026-10-31')).toBe('2026-10');
    expect(periodoOf('2026-01-01')).toBe('2026-01');
  });
});

describe('heMinutos', () => {
  it('is the difference when both times exist', () => {
    expect(heMinutos('17:00', '18:30')).toBe(90);
  });
  it('crosses midnight when the end is earlier than the start', () => {
    expect(heMinutos('23:00', '01:00')).toBe(120);
  });
  it('is 0 for equal times (not read as 24 hours)', () => {
    expect(heMinutos('08:00', '08:00')).toBe(0);
  });
  it('is 0 when one or both times are missing', () => {
    expect(heMinutos('08:00', null)).toBe(0);
    expect(heMinutos(null, '08:00')).toBe(0);
    expect(heMinutos(null, null)).toBe(0);
  });
});

describe('isValidFechaForm', () => {
  const now = new Date('2026-10-29T03:00:00Z'); // 2026-10-28 22:00 in Lima

  it('uses the Lima date for "today"', () => {
    expect(todayIn('America/Lima', now)).toBe('2026-10-28');
  });
  it('accepts today and tomorrow, rejects the day after', () => {
    expect(isValidFechaForm('2026-10-28', now)).toBe(true);
    expect(isValidFechaForm('2026-10-29', now)).toBe(true);
    expect(isValidFechaForm('2026-10-30', now)).toBe(false);
  });
  it('rejects dates before 2020-01-01', () => {
    expect(isValidFechaForm('2019-12-31', now)).toBe(false);
    expect(isValidFechaForm('2020-01-01', now)).toBe(true);
  });
  it('rejects dates that do not exist or are malformed', () => {
    expect(isValidFechaForm('2026-02-30', now)).toBe(false);
    expect(isValidFechaForm('2026-13-01', now)).toBe(false);
    expect(isValidFechaForm('26-10-01', now)).toBe(false);
  });
  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
});

describe('reviewReason', () => {
  const ok = {
    costoMovilidad: 10,
    otrosGastos: 0,
    heInicio: null,
    heFin: null,
    heMinutos: 0,
    possibleDuplicate: false,
  };

  it('is null when nothing needs review', () => {
    expect(reviewReason(ok)).toBeNull();
  });
  it('flags incomplete overtime', () => {
    expect(reviewReason({ ...ok, heInicio: '17:00' })).toBe(
      'incomplete_overtime',
    );
    expect(reviewReason({ ...ok, heFin: '17:00' })).toBe('incomplete_overtime');
  });
  it('flags equal overtime times as invalid', () => {
    expect(reviewReason({ ...ok, heInicio: '17:00', heFin: '17:00' })).toBe(
      'invalid_overtime',
    );
  });
  it('flags no_amounts, but not when there is overtime', () => {
    const empty = { ...ok, costoMovilidad: 0 };
    expect(reviewReason(empty)).toBe('no_amounts');
    expect(
      reviewReason({ ...empty, heInicio: '17:00', heFin: '18:00', heMinutos: 60 }),
    ).toBeNull();
  });
  it('flags possible_duplicate', () => {
    expect(reviewReason({ ...ok, possibleDuplicate: true })).toBe(
      'possible_duplicate',
    );
  });
  it('combines flags in the fixed order', () => {
    expect(
      reviewReason({
        costoMovilidad: 0,
        otrosGastos: 0,
        heInicio: '17:00',
        heFin: null,
        heMinutos: 0,
        possibleDuplicate: true,
      }),
    ).toBe('incomplete_overtime,no_amounts,possible_duplicate');
    expect(
      reviewReason({
        costoMovilidad: 0,
        otrosGastos: 0,
        heInicio: '17:00',
        heFin: '17:00',
        heMinutos: 0,
        possibleDuplicate: false,
      }),
    ).toBe('invalid_overtime,no_amounts');
  });
});
