import { ApiError } from '@/api/client'
import { loginErrorMessage } from './login-error'

describe('loginErrorMessage', () => {
  it('uses one message for wrong credentials', () => {
    expect(loginErrorMessage(new ApiError(401, 'x'))).toBe('Usuario o contraseña incorrectos.')
  })
  it('explains the rate limit', () => {
    expect(loginErrorMessage(new ApiError(429, 'x'))).toContain('Demasiados intentos')
  })
  it('falls back for other errors', () => {
    expect(loginErrorMessage(new Error('network'))).toContain('No se pudo iniciar sesión')
  })
})
