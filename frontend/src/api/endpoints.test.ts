import { afterEach, vi } from 'vitest'
import { ApiError, request, setUnauthorizedHandler } from './client'
import { buildQuery, realApi } from './endpoints'

afterEach(() => vi.unstubAllGlobals())

function stubFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('buildQuery', () => {
  it('skips undefined values and keeps false', () => {
    expect(buildQuery({ periodo: '2026-10', cliente: undefined, por_revisar: false })).toBe(
      '?periodo=2026-10&por_revisar=false',
    )
  })
  it('returns an empty string without params', () => {
    expect(buildQuery({ periodo: undefined })).toBe('')
  })
})

describe('request', () => {
  it('sends credentials and the JSON body', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: async () => ({ ok: 1 }) })
    await request('/x', { method: 'POST', body: { a: 1 } })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.credentials).toBe('include')
    expect(init.body).toBe('{"a":1}')
  })

  it('calls the unauthorized handler on 401 and throws ApiError', async () => {
    stubFetch({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ message: 'no' }) })
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    await expect(request('/x')).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('joins Nest validation messages', async () => {
    stubFetch({ ok: false, status: 400, statusText: 'Bad Request', json: async () => ({ message: ['a', 'b'] }) })
    await expect(request('/x')).rejects.toMatchObject({ status: 400, message: 'a, b' })
  })
})

describe('realApi', () => {
  it('encodes the normalized text in the DELETE path', async () => {
    const fetchMock = stubFetch({ ok: true, status: 204 })
    await realApi.deleteEquivalencia('jesus maria')
    expect(fetchMock.mock.calls[0][0]).toContain('/distritos/equivalencias/jesus%20maria')
  })
})
