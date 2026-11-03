import type { DiarioItem } from '@/api/types'
import { fillAccumulated } from './chart-data'

const item = (fecha: string, acumulado: number): DiarioItem => ({
  fecha,
  costo_movilidad: acumulado,
  otros_gastos: 0,
  total: acumulado,
  registros: 1,
  acumulado,
})

describe('fillAccumulated', () => {
  it('returns nothing without records', () => {
    expect(fillAccumulated([])).toEqual([])
  })

  it('fills gaps from day 1 carrying the running total', () => {
    const points = fillAccumulated([item('2026-10-02', 10), item('2026-10-05', 25)])
    expect(points.map((p) => p.acumulado)).toEqual([0, 10, 10, 10, 25])
    expect(points[0].fecha).toBe('2026-10-01')
    expect(points[4].dia).toBe(5)
  })
})
