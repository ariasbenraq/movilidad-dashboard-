export const DEFAULT_TIMEZONE = 'America/Lima';
export const MIN_FECHA_FORM = '2020-01-01';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isRealDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/** Today as YYYY-MM-DD in the given time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** A real calendar date between MIN_FECHA_FORM and today + 1 day. */
export function isValidFechaForm(
  value: string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): boolean {
  if (!isRealDate(value)) return false;
  const max = addDays(todayIn(timeZone, now), 1);
  return value >= MIN_FECHA_FORM && value <= max;
}

export function periodoOf(fechaForm: string): string {
  return fechaForm.slice(0, 7);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Overtime minutes: only when both times exist and differ. An end earlier
 * than the start crosses midnight.
 */
export function heMinutos(
  inicio: string | null,
  fin: string | null,
): number {
  if (inicio === null || fin === null || inicio === fin) return 0;
  return (((toMinutes(fin) - toMinutes(inicio)) % 1440) + 1440) % 1440;
}

export interface ReviewInput {
  costoMovilidad: number;
  otrosGastos: number;
  heInicio: string | null;
  heFin: string | null;
  heMinutos: number;
  possibleDuplicate: boolean;
}

/** Review codes in their fixed order, or null when nothing needs review. */
export function reviewReason(input: ReviewInput): string | null {
  const flags: string[] = [];
  const hasInicio = input.heInicio !== null;
  const hasFin = input.heFin !== null;

  if (hasInicio !== hasFin) flags.push('incomplete_overtime');
  if (hasInicio && hasFin && input.heInicio === input.heFin) {
    flags.push('invalid_overtime');
  }
  if (
    input.costoMovilidad === 0 &&
    input.otrosGastos === 0 &&
    input.heMinutos === 0
  ) {
    flags.push('no_amounts');
  }
  if (input.possibleDuplicate) flags.push('possible_duplicate');

  return flags.length > 0 ? flags.join(',') : null;
}
