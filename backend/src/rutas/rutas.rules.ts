import { createHash } from 'node:crypto';
import { normalizeDistrito } from '../ingest/ingest.rules.js';
import { esCerrado, periodoAnterior } from '../periodo/periodo.rules.js';

/** SHA-256 of the normalized address: the key of rutas_cache (never the address itself). */
export function hashDireccion(direccion: string): string {
  return createHash('sha256')
    .update(normalizeDistrito(direccion))
    .digest('hex');
}

export const rutaKey = (desde: string, hacia: string) =>
  `${desde}\u0000${hacia}`;

/**
 * The base months of a budget: the last `n` closed months before `periodo`,
 * ascending, never going back past the month of the first stored record (months
 * before the history exists would only dilute the average with zeros).
 */
export function mesesBase(
  periodo: string,
  today: string,
  n: number,
  primerPeriodo: string | null,
): string[] {
  if (primerPeriodo === null) return [];
  const base: string[] = [];
  let p = periodoAnterior(periodo);
  while (base.length < n && p >= primerPeriodo) {
    if (esCerrado(p, today)) base.push(p);
    p = periodoAnterior(p);
  }
  return base.reverse();
}

export const distanciaKm = (metros: number) => Math.round(metros / 100) / 10;

/** Taxi minutes per trip: the provider's driving time times the traffic factor. */
export function duracionTaxiMin(
  duracionS: number,
  factorTrafico: number,
): number {
  return Math.round((duracionS * factorTrafico) / 60);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface RutaBase {
  desde: string;
  hacia: string;
  /** Trips in all the base months together. */
  viajes: number;
  costoCents: number;
  /** Taxi minutes per trip, or null while the route is not computed. */
  duracionMin: number | null;
}

export interface BusRuta {
  desde: string;
  hacia: string;
  entradas: number;
  costoCents: number;
  duracionMin: number | null;
}

export interface PresupuestoRuta {
  desde: string;
  hacia: string;
  viajes_esperados: number;
  taxi: {
    costo_promedio: number;
    costo_total: number;
    duracion_min: number | null;
  };
  bus: {
    costo_promedio: number;
    costo_total: number;
    duracion_min: number | null;
  } | null;
}

export interface PresupuestoResultado {
  taxi: { total: number; minutos: number; incompleto: boolean };
  bus: { total: number; minutos: number; incompleto: boolean };
  diferencia_costo: number | null;
  rutas: PresupuestoRuta[];
}

/**
 * Expected trips per month = average over the base months, rounded; routes under
 * half a trip a month are left out. Money is summed in integer cents.
 */
export function presupuestar(
  rutas: RutaBase[],
  bus: BusRuta[],
  meses: number,
): PresupuestoResultado {
  const busPorRuta = new Map(bus.map((b) => [rutaKey(b.desde, b.hacia), b]));
  let taxiCents = 0;
  let taxiMin = 0;
  let taxiIncompleto = false;
  let busCents = 0;
  let busMin = 0;
  let busIncompleto = false;
  const out: PresupuestoRuta[] = [];

  for (const r of rutas) {
    const esperados = meses > 0 ? Math.round(r.viajes / meses) : 0;
    if (esperados < 1) continue;

    const promedioCents = Math.round(r.costoCents / r.viajes);
    taxiCents += esperados * promedioCents;
    if (r.duracionMin === null) taxiIncompleto = true;
    else taxiMin += esperados * r.duracionMin;

    const b = busPorRuta.get(rutaKey(r.desde, r.hacia));
    let busItem: PresupuestoRuta['bus'] = null;
    if (b) {
      const busPromedio = Math.round(b.costoCents / b.entradas);
      busCents += esperados * busPromedio;
      if (b.duracionMin !== null) busMin += esperados * b.duracionMin;
      busItem = {
        costo_promedio: busPromedio / 100,
        costo_total: (esperados * busPromedio) / 100,
        duracion_min: b.duracionMin,
      };
    } else {
      busIncompleto = true;
    }

    out.push({
      desde: r.desde,
      hacia: r.hacia,
      viajes_esperados: esperados,
      taxi: {
        costo_promedio: promedioCents / 100,
        costo_total: (esperados * promedioCents) / 100,
        duracion_min: r.duracionMin,
      },
      bus: busItem,
    });
  }

  out.sort(
    (a, b) =>
      b.viajes_esperados - a.viajes_esperados ||
      a.desde.localeCompare(b.desde) ||
      a.hacia.localeCompare(b.hacia),
  );
  return {
    taxi: {
      total: taxiCents / 100,
      minutos: taxiMin,
      incompleto: taxiIncompleto,
    },
    bus: { total: busCents / 100, minutos: busMin, incompleto: busIncompleto },
    diferencia_costo: busIncompleto ? null : (taxiCents - busCents) / 100,
    rutas: out,
  };
}
