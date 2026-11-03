import { ApiError } from '@/api/client'

export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Usuario o contraseña incorrectos.'
    if (error.status === 429) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  }
  return 'No se pudo iniciar sesión. Inténtalo de nuevo.'
}
