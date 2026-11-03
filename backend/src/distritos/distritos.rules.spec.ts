import {
  agruparSinMapear,
  mesesRestantes,
  textosQueNormalizanA,
  visitasAnioEstimadas,
} from './distritos.rules.js';

describe('agruparSinMapear', () => {
  it('counts records per normalized text, most used first', () => {
    const result = agruparSinMapear([
      { id: '1', texto: 'Sjm' },
      { id: '2', texto: 'Sjm' },
      { id: '3', texto: 'Surco' },
      { id: '4', texto: 'SJM' },
      { id: '5', texto: 'sjm' },
    ]);
    expect(result).toEqual([
      { texto: 'Sjm', registros: 4 },
      { texto: 'Surco', registros: 1 },
    ]);
  });

  it('counts a record once when origin and destination share the text', () => {
    expect(
      agruparSinMapear([
        { id: '1', texto: 'Surco' },
        { id: '1', texto: 'SURCO' },
      ]),
    ).toEqual([{ texto: 'Surco', registros: 1 }]);
  });

  it('merges accents and breaks ties alphabetically', () => {
    expect(
      agruparSinMapear([
        { id: '1', texto: 'Jesús María' },
        { id: '2', texto: 'Jesus Maria' },
        { id: '3', texto: 'Barranco' },
        { id: '4', texto: 'Ate' },
      ]),
    ).toEqual([
      { texto: 'Jesus Maria', registros: 2 },
      { texto: 'Ate', registros: 1 },
      { texto: 'Barranco', registros: 1 },
    ]);
  });

  it('is empty when nothing is unmapped and ignores blank texts', () => {
    expect(agruparSinMapear([])).toEqual([]);
    expect(agruparSinMapear([{ id: '1', texto: '   ' }])).toEqual([]);
  });
});

describe('textosQueNormalizanA', () => {
  it('returns each distinct raw spelling that matches the key', () => {
    expect(
      textosQueNormalizanA('jesus maria', [
        'Jesús María',
        'JESUS  MARIA',
        'Jesús María',
        'Surco',
      ]),
    ).toEqual(['Jesús María', 'JESUS  MARIA']);
    expect(textosQueNormalizanA('x', ['Surco'])).toEqual([]);
  });
});

describe('year estimate', () => {
  it('has 12 - month months left', () => {
    expect(mesesRestantes('2026-10')).toBe(2);
    expect(mesesRestantes('2026-12')).toBe(0);
    expect(mesesRestantes('2026-01')).toBe(11);
  });
  it('adds the month visits times the remaining months', () => {
    expect(visitasAnioEstimadas(61, 9, 2)).toBe(79);
    expect(visitasAnioEstimadas(5, 5, 0)).toBe(5);
  });
});
