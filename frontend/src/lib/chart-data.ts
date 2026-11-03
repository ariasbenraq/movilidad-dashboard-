import type { DiarioItem } from '@/api/types'

export interface AccumulatedPoint {
  fecha: string
  dia: number
  acumulado: number
}

function nextDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

// The API only returns days with records. For the area chart we fill the gaps
// between the first day of the month and the last record, carrying the running
// total forward. Totals come from the API; nothing is recomputed here.
export function fillAccumulated(items: DiarioItem[]): AccumulatedPoint[] {
  if (items.length === 0) return []
  const byDate = new Map(items.map((item) => [item.fecha, item.acumulado]))
  const last = items[items.length - 1].fecha
  const points: AccumulatedPoint[] = []
  let carried = 0
  for (let fecha = `${last.slice(0, 7)}-01`; fecha <= last; fecha = nextDay(fecha)) {
    carried = byDate.get(fecha) ?? carried
    points.push({ fecha, dia: Number(fecha.slice(8)), acumulado: carried })
  }
  return points
}
