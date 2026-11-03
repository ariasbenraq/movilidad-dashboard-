import { formatDate, formatMinutes, formatPEN, formatTimestamp } from './format'

describe('formatPEN', () => {
  it('formats amounts as Peruvian soles', () => {
    expect(formatPEN(412.3)).toMatch(/^S\/\s?412\.30$/)
  })
})

describe('formatDate', () => {
  it('does not shift calendar days with the browser time zone', () => {
    expect(formatDate('2026-11-16')).toContain('16')
    expect(formatDate('2026-11-16')).toContain('2026')
  })
})

describe('formatTimestamp', () => {
  it('shows the hour in America/Lima', () => {
    // 23:30 UTC is 18:30 in Lima (UTC-5)
    expect(formatTimestamp('2026-10-29T23:30:00Z')).toContain('18:30')
  })
})

describe('formatMinutes', () => {
  it('formats minutes, hours and both', () => {
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(120)).toBe('2 h')
    expect(formatMinutes(150)).toBe('2 h 30 min')
  })
})
