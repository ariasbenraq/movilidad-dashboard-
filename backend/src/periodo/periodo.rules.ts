import { addDays } from '../ingest/ingest.rules.js';

export const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface PeriodoConfig {
  timezone: string;
  /** ISO weekdays (1 = Monday ... 7 = Sunday) that count as working days. */
  diasLaborables: number[];
  pagoDia: number;
  pagoFinDeSemana: 'next' | 'previous';
  /** PEN per overtime hour; null when no rate is configured. */
  tarifaHoraExtra: number | null;
}

export const DEFAULT_CONFIG: PeriodoConfig = {
  timezone: 'America/Lima',
  diasLaborables: [1, 2, 3, 4, 5, 6],
  pagoDia: 15,
  pagoFinDeSemana: 'next',
  tarifaHoraExtra: null,
};

/** Reads the config table rows; a missing or invalid value falls back to the default. */
export function parseConfig(
  rows: { key: string; value: string }[],
): PeriodoConfig {
  const raw = new Map(rows.map((r) => [r.key, r.value.trim()]));
  const config = { ...DEFAULT_CONFIG };

  const timezone = raw.get('timezone');
  if (timezone) config.timezone = timezone;

  const dias = (raw.get('dias_laborables') ?? '')
    .split(',')
    .map((d) => Number(d.trim()));
  if (
    dias.length > 0 &&
    dias.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)
  ) {
    config.diasLaborables = dias;
  }

  const pagoDia = Number(raw.get('pago_dia'));
  if (Number.isInteger(pagoDia) && pagoDia >= 1 && pagoDia <= 28) {
    config.pagoDia = pagoDia;
  }

  const finde = raw.get('pago_fin_de_semana');
  if (finde === 'next' || finde === 'previous') config.pagoFinDeSemana = finde;

  const tarifa = Number(raw.get('tarifa_hora_extra'));
  if (raw.has('tarifa_hora_extra') && Number.isFinite(tarifa) && tarifa > 0) {
    config.tarifaHoraExtra = tarifa;
  }
  return config;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function primerDia(periodo: string): string {
  return `${periodo}-01`;
}

export function diasDelMes(periodo: string): number {
  const [year, month] = periodo.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function ultimoDia(periodo: string): string {
  return `${periodo}-${pad(diasDelMes(periodo))}`;
}

export function siguientePeriodo(periodo: string): string {
  const [year, month] = periodo.split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;
}

/** A period is closed once today (in the configured zone) is after its last day. */
export function esCerrado(periodo: string, today: string): boolean {
  return today > ultimoDia(periodo);
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Business day for payments: Monday to Friday and not a holiday. */
function esDiaHabil(date: string, feriados: ReadonlySet<string>): boolean {
  return isoWeekday(date) <= 5 && !feriados.has(date);
}

/** Payday of a period: `pagoDia` of the next month, moved off weekends and holidays. */
export function fechaPago(
  periodo: string,
  config: PeriodoConfig,
  feriados: ReadonlySet<string>,
): string {
  let date = `${siguientePeriodo(periodo)}-${pad(config.pagoDia)}`;
  const step = config.pagoFinDeSemana === 'next' ? 1 : -1;
  for (let i = 0; i < 15 && !esDiaHabil(date, feriados); i++) {
    date = addDays(date, step);
  }
  return date;
}

/** Working days after today (excluding today) until the last day of the period. */
export function diasLaborablesRestantes(
  periodo: string,
  today: string,
  config: PeriodoConfig,
  feriados: ReadonlySet<string>,
): number {
  const first = primerDia(periodo);
  const tomorrow = addDays(today, 1);
  let date = tomorrow > first ? tomorrow : first;
  const last = ultimoDia(periodo);
  let count = 0;
  while (date <= last) {
    if (
      config.diasLaborables.includes(isoWeekday(date)) &&
      !feriados.has(date)
    ) {
      count++;
    }
    date = addDays(date, 1);
  }
  return count;
}

/** Days of the period that have already started (all of them once it is closed). */
export function diasTranscurridos(periodo: string, today: string): number {
  if (today > ultimoDia(periodo)) return diasDelMes(periodo);
  if (today < primerDia(periodo)) return 0;
  return Number(today.slice(8, 10));
}

export interface ProyeccionInput {
  acumuladoCents: number;
  diasConGasto: number;
  diasLaborablesRestantes: number;
  cerrado: boolean;
}

export interface ProyeccionResult {
  acumulado: number;
  promedio_diario: number;
  dias_con_gasto: number;
  dias_laborables_restantes: number;
  proyectado: number;
  muestra_insuficiente: boolean;
  progreso: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Money math in integer cents; every figure is rounded once, at the end. */
export function proyectar(input: ProyeccionInput): ProyeccionResult {
  const { acumuladoCents, diasConGasto, cerrado } = input;
  const restantes = cerrado ? 0 : input.diasLaborablesRestantes;
  const promedioCents = diasConGasto > 0 ? acumuladoCents / diasConGasto : 0;
  const proyectadoCents = cerrado
    ? acumuladoCents
    : Math.round(acumuladoCents + promedioCents * restantes);

  let progreso = 1;
  if (!cerrado) {
    progreso =
      proyectadoCents === 0 ? 0 : round2(acumuladoCents / proyectadoCents);
  }

  return {
    acumulado: acumuladoCents / 100,
    promedio_diario: Math.round(promedioCents) / 100,
    dias_con_gasto: diasConGasto,
    dias_laborables_restantes: restantes,
    proyectado: proyectadoCents / 100,
    muestra_insuficiente: diasConGasto < 3,
    progreso,
  };
}

/** Overtime amount, or null when no hourly rate is configured. */
export function horasExtraMonto(
  minutos: number,
  tarifaHoraExtra: number | null,
): number | null {
  if (tarifaHoraExtra === null) return null;
  return Math.round(((minutos * tarifaHoraExtra) / 60) * 100) / 100;
}

/** ISO 8601 with the zone's UTC offset, e.g. 2026-10-29T18:12:00-05:00. */
export function toIsoInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const offset = get('timeZoneName').replace('GMT', '') || '+00:00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${offset}`;
}
