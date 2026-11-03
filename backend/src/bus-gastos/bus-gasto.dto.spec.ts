import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BusGastoDto } from './bus-gasto.dto.js';

const valid = {
  fecha: '2025-03-05',
  desde: 'Sjm',
  hacia: 'Jesús María',
  costo: 3.5,
  duracion_min: 75,
  nota: null,
};

const check = async (over: Record<string, unknown> = {}) => {
  const dto = plainToInstance(BusGastoDto, { ...valid, ...over });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: errors.map((e) => e.property).sort() };
};

describe('BusGastoDto', () => {
  it('accepts the contract example', async () => {
    expect((await check()).fields).toEqual([]);
  });

  it('accepts the limits and the optional fields missing or null', async () => {
    expect((await check({ costo: 0 })).fields).toEqual([]);
    expect((await check({ costo: 500 })).fields).toEqual([]);
    expect((await check({ duracion_min: 1 })).fields).toEqual([]);
    expect((await check({ duracion_min: 600 })).fields).toEqual([]);
    expect((await check({ duracion_min: undefined })).fields).toEqual([]);
    expect(
      (await check({ duracion_min: null, nota: undefined })).fields,
    ).toEqual([]);
    expect((await check({ nota: 'x'.repeat(200) })).fields).toEqual([]);
  });

  it('trims strings and turns an empty note into null', async () => {
    const { dto } = await check({ desde: '  Sjm ', nota: '   ' });
    expect(dto.desde).toBe('Sjm');
    expect(dto.nota).toBeNull();
  });

  it.each([
    ['costo as string', { costo: '3.5' }, 'costo'],
    ['costo over 500', { costo: 500.01 }, 'costo'],
    ['negative costo', { costo: -1 }, 'costo'],
    ['3 decimals', { costo: 3.123 }, 'costo'],
    ['missing costo', { costo: undefined }, 'costo'],
    ['duracion 0', { duracion_min: 0 }, 'duracion_min'],
    ['duracion 601', { duracion_min: 601 }, 'duracion_min'],
    ['fractional duracion', { duracion_min: 1.5 }, 'duracion_min'],
    ['duracion as string', { duracion_min: '75' }, 'duracion_min'],
    ['nota over 200', { nota: 'x'.repeat(201) }, 'nota'],
    ['missing desde', { desde: undefined }, 'desde'],
    ['blank desde', { desde: '   ' }, 'desde'],
    ['desde over 100', { desde: 'x'.repeat(101) }, 'desde'],
    ['blank hacia', { hacia: '' }, 'hacia'],
    ['impossible date', { fecha: '2025-02-30' }, 'fecha'],
    ['date before 2020', { fecha: '2019-12-31' }, 'fecha'],
    ['date after tomorrow', { fecha: '2099-01-01' }, 'fecha'],
    ['unknown field', { duracion: 75 }, 'duracion'],
  ])('rejects %s', async (_name, over, field) => {
    expect((await check(over)).fields).toContain(field);
  });
});
