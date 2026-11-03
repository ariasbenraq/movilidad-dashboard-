import { clampPeriodo, joinPeriodo, MIN_PERIODO, monthName, shiftPeriodo, yearOptions } from './period'

describe('shiftPeriodo', () => {
  it('moves within a year', () => {
    expect(shiftPeriodo('2026-10', -1)).toBe('2026-09')
    expect(shiftPeriodo('2026-10', 1)).toBe('2026-11')
  })
  it('crosses year boundaries', () => {
    expect(shiftPeriodo('2026-01', -1)).toBe('2025-12')
    expect(shiftPeriodo('2025-12', 1)).toBe('2026-01')
    expect(shiftPeriodo('2026-03', -15)).toBe('2024-12')
  })
})

describe('clampPeriodo', () => {
  it('keeps the value between the minimum and the maximum', () => {
    expect(clampPeriodo('2019-05', '2026-11')).toBe(MIN_PERIODO)
    expect(clampPeriodo('2027-01', '2026-11')).toBe('2026-11')
    expect(clampPeriodo('2026-03', '2026-11')).toBe('2026-03')
  })
})

describe('yearOptions', () => {
  it('lists years from the latest down to 2020', () => {
    expect(yearOptions('2026-11')).toEqual([2026, 2025, 2024, 2023, 2022, 2021, 2020])
  })
})

describe('joinPeriodo / monthName', () => {
  it('pads months', () => {
    expect(joinPeriodo(2026, 3)).toBe('2026-03')
  })
  it('names months in Spanish', () => {
    expect(monthName(10).toLowerCase()).toContain('oct')
  })
})
