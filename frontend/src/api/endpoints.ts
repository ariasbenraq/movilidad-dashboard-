import { request } from './client'
import type {
  AnaliticaDistritos,
  AnaliticaRutas,
  BusGastoRequest,
  BusGastos,
  Diario,
  Equivalencia,
  EquivalenciaRequest,
  Equivalencias,
  LoginRequest,
  Me,
  Periodo,
  Presupuesto,
  Proyeccion,
  RegistrosPage,
  RegistrosQuery,
  Resumen,
} from './types'

type QueryValue = string | number | boolean | undefined

// Builds `?a=1&b=2`, skipping undefined values and keeping the order given.
export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

// The ApiService shape is what the mocks implement too (see index.ts).
export const realApi = {
  login: (credentials: LoginRequest) =>
    request<void>('/auth/login', { method: 'POST', body: credentials, handle401: false }),
  logout: () => request<void>('/auth/logout', { method: 'POST', handle401: false }),
  getMe: () => request<Me>('/auth/me', { handle401: false }),
  getResumen: (periodo?: Periodo) => request<Resumen>(`/resumen${buildQuery({ periodo })}`),
  getProyeccion: (periodo?: Periodo) => request<Proyeccion>(`/proyeccion${buildQuery({ periodo })}`),
  getDiario: (periodo?: Periodo) => request<Diario>(`/diario${buildQuery({ periodo })}`),
  getRegistros: (query: RegistrosQuery = {}) =>
    request<RegistrosPage>(`/registros${buildQuery({ ...query })}`),
  getAnaliticaDistritos: (periodo?: Periodo) =>
    request<AnaliticaDistritos>(`/analitica/distritos${buildQuery({ periodo })}`),
  getEquivalencias: () => request<Equivalencias>('/distritos/equivalencias'),
  putEquivalencia: (body: EquivalenciaRequest) =>
    request<Equivalencia>('/distritos/equivalencias', { method: 'PUT', body }),
  deleteEquivalencia: (textoNormalizado: string) =>
    request<void>(`/distritos/equivalencias/${encodeURIComponent(textoNormalizado)}`, {
      method: 'DELETE',
    }),

  // v2
  getBusGastos: (periodo?: Periodo) => request<BusGastos>(`/bus-gastos${buildQuery({ periodo })}`),
  postBusGasto: (body: BusGastoRequest) =>
    request<{ id: number }>('/bus-gastos', { method: 'POST', body }),
  putBusGasto: (id: number, body: BusGastoRequest) =>
    request<void>(`/bus-gastos/${id}`, { method: 'PUT', body }),
  deleteBusGasto: (id: number) => request<void>(`/bus-gastos/${id}`, { method: 'DELETE' }),
  getAnaliticaRutas: (periodo?: Periodo) =>
    request<AnaliticaRutas>(`/analitica/rutas${buildQuery({ periodo })}`),
  getPresupuesto: (periodo?: Periodo) =>
    request<Presupuesto>(`/presupuesto${buildQuery({ periodo })}`),
}

export type ApiService = typeof realApi
