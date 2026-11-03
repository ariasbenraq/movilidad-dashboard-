import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useProyeccion, useRegistros } from './queries'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('query hooks (mock api)', () => {
  it('returns the projection', async () => {
    const { result } = renderHook(() => useProyeccion('2026-10'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.proyectado).toBe(451.56)
  })

  it('filters flagged records', async () => {
    const { result } = renderHook(() => useRegistros({ por_revisar: true }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items.every((r) => r.needs_review)).toBe(true)
  })
})
