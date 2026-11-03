// Mirrors docs/api-contract.md exactly. Do not add fields that are not in the contract.
// Money is always a JSON number in PEN. Dates are `YYYY-MM-DD`, times `HH:MM`.

/** `YYYY-MM` */
export type Periodo = string

// ---- Auth (v1) ----

export interface LoginRequest {
  username: string
  password: string
}

export interface Me {
  username: string
}

/** Nest default error shape. */
export interface ApiErrorBody {
  statusCode: number
  message: string | string[]
  error: string
}

// ---- Summary and projection (v1) ----

export interface Resumen {
  periodo: Periodo
  cerrado: boolean
  total: number
  costo_movilidad: number
  otros_gastos: number
  registros: number
  por_revisar: number
  horas_extra_minutos: number
  horas_extra_monto: number | null
  ultimo_registro_at: string
  fecha_pago: string
}

export interface Proyeccion {
  periodo: Periodo
  cerrado: boolean
  acumulado: number
  promedio_diario: number
  dias_con_gasto: number
  dias_laborables_restantes: number
  /** Upper-end estimate by design. */
  proyectado: number
  muestra_insuficiente: boolean
  /** acumulado / proyectado, between 0 and 1. */
  progreso: number
  dias_transcurridos: number
  dias_del_mes: number
  fecha_pago: string
  horas_extra_minutos: number
  horas_extra_monto: number | null
}

export interface DiarioItem {
  fecha: string
  costo_movilidad: number
  otros_gastos: number
  total: number
  registros: number
  acumulado: number
}

export interface Diario {
  periodo: Periodo
  items: DiarioItem[]
}

// ---- Records (v1) ----

export interface RegistrosQuery {
  periodo?: Periodo
  desde?: string
  hasta?: string
  cliente?: string
  workorder?: string
  por_revisar?: boolean
  page?: number
  limit?: number
}

export interface Lugar {
  distrito: string
  /** null when the text has no equivalence yet. */
  distrito_canon: string | null
  direccion: string
}

export type ReviewCode =
  | 'incomplete_overtime'
  | 'invalid_overtime'
  | 'no_amounts'
  | 'possible_duplicate'
  | 'unknown_district'

export interface Registro {
  id: number
  fecha: string
  hora_inicio: string
  workorder: string
  cliente: string
  desde: Lugar
  hacia: Lugar
  costo_movilidad: number
  otros_gastos: number
  otros_detalle: string | null
  total: number
  he_inicio: string | null
  he_fin: string | null
  he_minutos: number
  needs_review: boolean
  /** Comma-separated ReviewCode values, or null. */
  review_reason: string | null
}

export interface RegistrosPage {
  items: Registro[]
  page: number
  limit: number
  /** Number of rows matching the filters. */
  total: number
}

// ---- District analytics (v1) ----

export interface DistritoCliente {
  cliente: string
  visitas: number
}

export interface DistritoWorkorder {
  workorder: string
  visitas: number
}

export interface DistritoAnalitica {
  /** null groups destinations without an equivalence. */
  distrito: string | null
  visitas: number
  costo_total: number
  costo_promedio: number
  clientes: DistritoCliente[]
  workorders: DistritoWorkorder[]
  visitas_anio_hasta_hoy: number
  meses_restantes: number
  visitas_anio_estimadas: number
}

export interface AnaliticaDistritos {
  periodo: Periodo
  items: DistritoAnalitica[]
}

// ---- Districts (v1) ----

export interface Equivalencia {
  texto_normalizado: string
  distrito: string
}

export interface SinMapear {
  texto: string
  registros: number
}

export interface Equivalencias {
  items: Equivalencia[]
  sin_mapear: SinMapear[]
}

export interface EquivalenciaRequest {
  texto: string
  distrito: string
}

// ---- Bus expenses (v2) ----

export interface BusGastoRequest {
  fecha: string
  desde: string
  hacia: string
  costo: number
  duracion_min?: number | null
  nota?: string | null
}

export interface BusLugar {
  distrito: string
  distrito_canon: string | null
}

export interface BusGasto {
  id: number
  fecha: string
  desde: BusLugar
  hacia: BusLugar
  costo: number
  duracion_min: number | null
  nota: string | null
}

export interface BusGastos {
  items: BusGasto[]
}

// ---- Routes and budget (v2) ----

export interface Ruta {
  desde: string
  hacia: string
  viajes: number
  costo_promedio: number
  costo_total: number
  distancia_km: number | null
  duracion_taxi_min: number | null
  geocode_confianza: number | null
}

export interface AnaliticaRutas {
  periodo: Periodo
  items: Ruta[]
}

export interface PresupuestoModo {
  costo_promedio: number
  costo_total: number
  duracion_min: number | null
}

export interface PresupuestoRuta {
  desde: string
  hacia: string
  viajes_esperados: number
  taxi: PresupuestoModo
  /** null when the route has no bus data. */
  bus: PresupuestoModo | null
}

export interface Presupuesto {
  periodo: Periodo
  base_meses: Periodo[]
  taxi: { total: number; minutos: number }
  bus: { total: number; minutos: number; incompleto: boolean }
  /** null while bus.incompleto is true. */
  diferencia_costo: number | null
  rutas: PresupuestoRuta[]
}
