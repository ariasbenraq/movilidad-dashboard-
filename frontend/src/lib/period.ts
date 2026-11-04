// Pure helpers to navigate between months. Which month is "the current one" is
// decided by the backend (it returns it in `periodo`); nothing here reads the clock.

/** Earliest month the backend accepts (`fecha_form` starts on 2020-01-01). */
export const MIN_PERIODO = '2020-01'

export function splitPeriodo(periodo: string): { year: number; month: number } {
  const [year, month] = periodo.split('-').map(Number)
  return { year, month }
}

export function joinPeriodo(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function shiftPeriodo(periodo: string, delta: number): string {
  const { year, month } = splitPeriodo(periodo)
  const index = year * 12 + (month - 1) + delta
  return joinPeriodo(Math.floor(index / 12), (index % 12) + 1)
}

export function clampPeriodo(periodo: string, max: string): string {
  if (periodo < MIN_PERIODO) return MIN_PERIODO
  return periodo > max ? max : periodo
}

export function yearOptions(max: string): number[] {
  const first = splitPeriodo(MIN_PERIODO).year
  const last = splitPeriodo(max).year
  return Array.from({ length: last - first + 1 }, (_, i) => last - i)
}

export function monthName(month: number): string {
  return new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, month - 1, 15)),
  )
}
