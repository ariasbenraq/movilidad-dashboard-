import type { ReviewCode } from '@/api/types'

const LABELS: Record<ReviewCode, string> = {
  incomplete_overtime: 'Horas extra incompletas',
  invalid_overtime: 'Horas extra inválidas',
  no_amounts: 'Sin montos',
  possible_duplicate: 'Posible duplicado',
  unknown_district: 'Distrito sin equivalencia',
}

// `review_reason` is a comma-separated string of codes, or null.
export function reviewLabels(reason: string | null): string[] {
  if (!reason) return []
  return reason
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
    .map((code) => LABELS[code as ReviewCode] ?? code)
}
