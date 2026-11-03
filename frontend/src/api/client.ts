import type { ApiErrorBody } from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let onUnauthorized: (() => void) | undefined

// The app registers where a 401 sends the user (the login page).
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  // Login and /auth/me handle their own 401.
  handle401?: boolean
}

function messageFrom(body: Partial<ApiErrorBody> | null, fallback: string): string {
  if (!body?.message) return fallback
  return Array.isArray(body.message) ? body.message.join(', ') : body.message
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, handle401 = true } = options
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    if (response.status === 401 && handle401) onUnauthorized?.()
    const errorBody = (await response.json().catch(() => null)) as Partial<ApiErrorBody> | null
    throw new ApiError(response.status, messageFrom(errorBody, response.statusText))
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
