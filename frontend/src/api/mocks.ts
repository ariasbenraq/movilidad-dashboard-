// Typed mocks for every endpoint. This is the single file to delete or ignore
// once the backend exists: index.ts decides whether the app uses it.
// Fictional data only; never paste real addresses or work orders here.
import type { ApiService } from './endpoints'
import { ApiError } from './client'
import type {
  BusGasto,
  Diario,
  DiarioItem,
  Equivalencia,
  Registro,
  RegistrosQuery,
} from './types'

const PERIODO = '2026-10'
const delay = <T>(value: T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), 250))

const diarioItems: DiarioItem[] = [
  { fecha: '2026-10-01', costo_movilidad: 24.5, otros_gastos: 0, total: 24.5, registros: 1, acumulado: 24.5 },
  { fecha: '2026-10-02', costo_movilidad: 31.9, otros_gastos: 6.5, total: 38.4, registros: 2, acumulado: 62.9 },
  { fecha: '2026-10-05', costo_movilidad: 18.0, otros_gastos: 0, total: 18.0, registros: 1, acumulado: 80.9 },
  { fecha: '2026-10-07', costo_movilidad: 29.9, otros_gastos: 6.5, total: 36.4, registros: 1, acumulado: 117.3 },
  { fecha: '2026-10-08', costo_movilidad: 22.4, otros_gastos: 0, total: 22.4, registros: 1, acumulado: 139.7 },
  { fecha: '2026-10-12', costo_movilidad: 35.0, otros_gastos: 0, total: 35.0, registros: 2, acumulado: 174.7 },
  { fecha: '2026-10-14', costo_movilidad: 27.3, otros_gastos: 9.5, total: 36.8, registros: 1, acumulado: 211.5 },
  { fecha: '2026-10-19', costo_movilidad: 40.2, otros_gastos: 0, total: 40.2, registros: 2, acumulado: 251.7 },
  { fecha: '2026-10-22', costo_movilidad: 25.6, otros_gastos: 0, total: 25.6, registros: 1, acumulado: 277.3 },
  { fecha: '2026-10-26', costo_movilidad: 33.5, otros_gastos: 6.5, total: 40.0, registros: 2, acumulado: 317.3 },
  { fecha: '2026-10-29', costo_movilidad: 78.4, otros_gastos: 16.6, total: 95.0, registros: 3, acumulado: 412.3 },
]

const registros: Registro[] = [
  {
    id: 4,
    fecha: '2026-10-29',
    hora_inicio: '16:40',
    workorder: 'W000000004',
    cliente: 'CLIENTE EJEMPLO C',
    desde: { distrito: 'Sjm', distrito_canon: 'San Juan de Lurigancho', direccion: 'Calle Ficticia 123' },
    hacia: { distrito: 'Miraflores', distrito_canon: 'Miraflores', direccion: 'Av. Inventada 456' },
    costo_movilidad: 31.5,
    otros_gastos: 0,
    otros_detalle: null,
    total: 31.5,
    he_inicio: null,
    he_fin: null,
    he_minutos: 0,
    needs_review: false,
    review_reason: null,
  },
  {
    id: 3,
    fecha: '2026-10-29',
    hora_inicio: '12:10',
    workorder: 'W000000003',
    cliente: 'CLIENTE EJEMPLO B',
    desde: { distrito: 'Sjm', distrito_canon: 'San Juan de Lurigancho', direccion: 'Calle Ficticia 123' },
    hacia: { distrito: 'Ate vitarte', distrito_canon: null, direccion: 'Jr. Imaginario 789' },
    costo_movilidad: 28.4,
    otros_gastos: 16.6,
    otros_detalle: 'Materiales de limpieza',
    total: 45,
    he_inicio: null,
    he_fin: null,
    he_minutos: 0,
    needs_review: true,
    review_reason: 'unknown_district',
  },
  {
    id: 2,
    fecha: '2026-10-07',
    hora_inicio: '15:00',
    workorder: 'W000000002',
    cliente: 'CLIENTE EJEMPLO A',
    desde: { distrito: 'Sjm', distrito_canon: 'San Juan de Lurigancho', direccion: 'Calle Ficticia 123' },
    hacia: { distrito: 'Jesus Maria', distrito_canon: 'Jesús María', direccion: 'Av. Inventada 100' },
    costo_movilidad: 29.9,
    otros_gastos: 6.5,
    otros_detalle: 'Insumos de mantenimiento',
    total: 36.4,
    he_inicio: '19:00',
    he_fin: null,
    he_minutos: 0,
    needs_review: true,
    review_reason: 'incomplete_overtime',
  },
  {
    id: 1,
    fecha: '2026-10-01',
    hora_inicio: '09:30',
    workorder: 'W000000001',
    cliente: 'CLIENTE EJEMPLO A',
    desde: { distrito: 'Sjm', distrito_canon: 'San Juan de Lurigancho', direccion: 'Calle Ficticia 123' },
    hacia: { distrito: 'Jesus Maria', distrito_canon: 'Jesús María', direccion: 'Av. Inventada 100' },
    costo_movilidad: 24.5,
    otros_gastos: 0,
    otros_detalle: null,
    total: 24.5,
    he_inicio: null,
    he_fin: null,
    he_minutos: 0,
    needs_review: false,
    review_reason: null,
  },
]

let equivalencias: Equivalencia[] = [
  { texto_normalizado: 'sjm', distrito: 'San Juan de Lurigancho' },
  { texto_normalizado: 'jesus maria', distrito: 'Jesús María' },
  { texto_normalizado: 'miraflores', distrito: 'Miraflores' },
]
let sinMapear = [{ texto: 'Ate vitarte', registros: 3 }]

let busGastos: BusGasto[] = [
  {
    id: 1,
    fecha: '2026-10-07',
    desde: { distrito: 'Sjm', distrito_canon: 'San Juan de Lurigancho' },
    hacia: { distrito: 'Jesús María', distrito_canon: 'Jesús María' },
    costo: 3.5,
    duracion_min: 75,
    nota: null,
  },
]

function filterRegistros(query: RegistrosQuery): Registro[] {
  return registros.filter(
    (r) =>
      (query.periodo === undefined || r.fecha.startsWith(query.periodo)) &&
      (query.desde === undefined || r.fecha >= query.desde) &&
      (query.hasta === undefined || r.fecha <= query.hasta) &&
      (query.cliente === undefined || r.cliente === query.cliente) &&
      (query.workorder === undefined || r.workorder === query.workorder) &&
      (!query.por_revisar || r.needs_review),
  )
}

// The mock session lives in memory only (no storage), so a page reload logs out.
let mockUser: string | null = null

export const mockApi: ApiService = {
  login: ({ username, password }) => {
    if (!username || !password) return Promise.reject(new ApiError(401, 'Unauthorized'))
    mockUser = username
    return delay(undefined)
  },
  logout: () => {
    mockUser = null
    return delay(undefined)
  },
  getMe: () =>
    mockUser === null ? Promise.reject(new ApiError(401, 'Unauthorized')) : delay({ username: mockUser }),

  getResumen: (periodo = PERIODO) =>
    delay({
      periodo,
      cerrado: false,
      total: 412.3,
      costo_movilidad: 389.8,
      otros_gastos: 22.5,
      registros: 21,
      por_revisar: 2,
      horas_extra_minutos: 150,
      horas_extra_monto: null,
      ultimo_registro_at: '2026-10-29T18:12:00-05:00',
      fecha_pago: '2026-11-16',
    }),

  getProyeccion: (periodo = PERIODO) =>
    delay({
      periodo,
      cerrado: false,
      acumulado: 412.3,
      promedio_diario: 19.63,
      dias_con_gasto: 21,
      dias_laborables_restantes: 2,
      proyectado: 451.56,
      muestra_insuficiente: false,
      progreso: 0.91,
      dias_transcurridos: 29,
      dias_del_mes: 31,
      fecha_pago: '2026-11-16',
      horas_extra_minutos: 150,
      horas_extra_monto: null,
    }),

  getDiario: (periodo = PERIODO): Promise<Diario> =>
    delay({ periodo, items: periodo === PERIODO ? diarioItems : [] }),

  getRegistros: (query = {}) => {
    const filtered = filterRegistros(query)
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    return delay({
      items: filtered.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: filtered.length,
    })
  },

  getAnaliticaDistritos: (periodo = PERIODO) =>
    delay({
      periodo,
      items: periodo !== PERIODO ? [] : [
        {
          distrito: 'Jesús María',
          visitas: 9,
          costo_total: 215.1,
          costo_promedio: 23.9,
          clientes: [
            { cliente: 'CLIENTE EJEMPLO A', visitas: 7 },
            { cliente: 'CLIENTE EJEMPLO B', visitas: 2 },
          ],
          workorders: [
            { workorder: 'W000000002', visitas: 2 },
            { workorder: 'W000000001', visitas: 1 },
          ],
          visitas_anio_hasta_hoy: 61,
          meses_restantes: 2,
          visitas_anio_estimadas: 79,
        },
        {
          distrito: 'Miraflores',
          visitas: 4,
          costo_total: 126,
          costo_promedio: 31.5,
          clientes: [{ cliente: 'CLIENTE EJEMPLO C', visitas: 4 }],
          workorders: [{ workorder: 'W000000004', visitas: 1 }],
          visitas_anio_hasta_hoy: 30,
          meses_restantes: 2,
          visitas_anio_estimadas: 38,
        },
        {
          distrito: null,
          visitas: 3,
          costo_total: 85.2,
          costo_promedio: 28.4,
          clientes: [{ cliente: 'CLIENTE EJEMPLO B', visitas: 3 }],
          workorders: [{ workorder: 'W000000003', visitas: 1 }],
          visitas_anio_hasta_hoy: 12,
          meses_restantes: 2,
          visitas_anio_estimadas: 18,
        },
      ],
    }),

  getEquivalencias: () => delay({ items: equivalencias, sin_mapear: sinMapear }),

  putEquivalencia: ({ texto, distrito }) => {
    const item = { texto_normalizado: texto.trim().toLowerCase(), distrito }
    equivalencias = [...equivalencias.filter((e) => e.texto_normalizado !== item.texto_normalizado), item]
    sinMapear = sinMapear.filter((s) => s.texto.trim().toLowerCase() !== item.texto_normalizado)
    return delay(item)
  },

  deleteEquivalencia: (textoNormalizado) => {
    equivalencias = equivalencias.filter((e) => e.texto_normalizado !== textoNormalizado)
    return delay(undefined)
  },

  // v2
  getBusGastos: () => delay({ items: busGastos }),

  postBusGasto: (body) => {
    const id = Math.max(0, ...busGastos.map((g) => g.id)) + 1
    busGastos = [
      {
        id,
        fecha: body.fecha,
        desde: { distrito: body.desde, distrito_canon: null },
        hacia: { distrito: body.hacia, distrito_canon: null },
        costo: body.costo,
        duracion_min: body.duracion_min ?? null,
        nota: body.nota ?? null,
      },
      ...busGastos,
    ]
    return delay({ id })
  },

  putBusGasto: (id, body) => {
    const updated: BusGasto = {
      id,
      fecha: body.fecha,
      desde: { distrito: body.desde, distrito_canon: null },
      hacia: { distrito: body.hacia, distrito_canon: null },
      costo: body.costo,
      duracion_min: body.duracion_min ?? null,
      nota: body.nota ?? null,
    }
    busGastos = busGastos.map((g) => (g.id === id ? updated : g))
    return delay(updated)
  },

  deleteBusGasto: (id) => {
    busGastos = busGastos.filter((g) => g.id !== id)
    return delay(undefined)
  },

  getAnaliticaRutas: (periodo = PERIODO) =>
    delay({
      periodo,
      items: [
        {
          desde: 'San Juan de Lurigancho',
          hacia: 'Jesús María',
          viajes: 9,
          costo_promedio: 23.9,
          costo_total: 215.1,
          distancia_km: 18.4,
          duracion_taxi_min: 52,
          geocode_confianza: 0.82,
        },
        {
          desde: 'San Juan de Lurigancho',
          hacia: 'Miraflores',
          viajes: 4,
          costo_promedio: 31.5,
          costo_total: 126,
          distancia_km: null,
          duracion_taxi_min: null,
          geocode_confianza: null,
        },
      ],
    }),

  getPresupuesto: (periodo = '2026-11') =>
    delay({
      periodo,
      base_meses: ['2026-08', '2026-09', '2026-10'],
      taxi: { total: 468, minutos: 1180 },
      bus: { total: 96.5, minutos: 2210, incompleto: true },
      diferencia_costo: null,
      rutas: [
        {
          desde: 'San Juan de Lurigancho',
          hacia: 'Jesús María',
          viajes_esperados: 9,
          taxi: { costo_promedio: 23.9, costo_total: 215.1, duracion_min: 52 },
          bus: { costo_promedio: 3.5, costo_total: 31.5, duracion_min: 75 },
        },
        {
          desde: 'San Juan de Lurigancho',
          hacia: 'Miraflores',
          viajes_esperados: 4,
          taxi: { costo_promedio: 31.5, costo_total: 126, duracion_min: null },
          bus: null,
        },
      ],
    }),
}
