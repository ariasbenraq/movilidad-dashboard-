export const MAX_DISTRITO = 100

// Mirrors the backend rule: `distrito` is required and at most 100 chars.
export function distritoError(value: string): string | null {
  const text = value.trim()
  if (text === '') return 'Escribe el distrito.'
  if (text.length > MAX_DISTRITO) return `Máximo ${MAX_DISTRITO} caracteres.`
  return null
}
