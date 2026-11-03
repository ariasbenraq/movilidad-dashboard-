import { Injectable } from '@nestjs/common';
import { PeriodoContext } from '../periodo/periodo.service.js';
import {
  RutaDirecciones,
  RutaViajes,
  RutasRepository,
} from './rutas.repository.js';
import { RutasRoutingService } from './rutas-routing.service.js';
import {
  distanciaKm,
  duracionTaxiMin,
  hashDireccion,
  mesesBase,
  presupuestar,
  PresupuestoResultado,
  round2,
  rutaKey,
} from './rutas.rules.js';

export interface RutaItem {
  desde: string;
  hacia: string;
  viajes: number;
  costo_promedio: number;
  costo_total: number;
  distancia_km: number | null;
  duracion_taxi_min: number | null;
  geocode_confianza: number | null;
}

export interface Presupuesto extends PresupuestoResultado {
  periodo: string;
  base_meses: string[];
}

interface Computada {
  distancia_km: number;
  duracion_taxi_min: number;
  geocode_confianza: number;
}

@Injectable()
export class RutasService {
  constructor(
    private readonly repo: RutasRepository,
    private readonly routing: RutasRoutingService,
  ) {}

  async rutas(
    periodo: string,
    ctx: PeriodoContext,
  ): Promise<{ periodo: string; items: RutaItem[] }> {
    const viajes = await this.repo.viajesPorRuta([periodo]);
    const computadas = await this.computadas([periodo], ctx);
    const items = viajes.map((v): RutaItem => {
      const c = computadas.get(rutaKey(v.desde, v.hacia));
      return {
        desde: v.desde,
        hacia: v.hacia,
        viajes: v.viajes,
        costo_promedio: Math.round(v.costoCents / v.viajes) / 100,
        costo_total: v.costoCents / 100,
        distancia_km: c?.distancia_km ?? null,
        duracion_taxi_min: c?.duracion_taxi_min ?? null,
        geocode_confianza: c?.geocode_confianza ?? null,
      };
    });
    return { periodo, items };
  }

  async presupuesto(
    periodo: string,
    ctx: PeriodoContext,
  ): Promise<Presupuesto> {
    const base = mesesBase(
      periodo,
      ctx.today,
      ctx.config.presupuestoMeses,
      await this.repo.primerPeriodo(),
    );
    const [viajes, bus, computadas] = await Promise.all([
      this.repo.viajesPorRuta(base),
      this.repo.busPorRuta(periodo),
      this.computadas(base, ctx),
    ]);
    const resultado = presupuestar(
      viajes.map((v: RutaViajes) => ({
        ...v,
        duracionMin:
          computadas.get(rutaKey(v.desde, v.hacia))?.duracion_taxi_min ?? null,
      })),
      bus,
      base.length,
    );
    return { periodo, base_meses: base, ...resultado };
  }

  /**
   * Cached route figures by canonical route; queues the routes still missing.
   * The route's addresses are its most frequent address pair in `periodos`.
   */
  private async computadas(
    periodos: string[],
    ctx: PeriodoContext,
  ): Promise<Map<string, Computada>> {
    const direcciones = await this.repo.direccionesPorRuta(periodos);
    const hashes = direcciones.map((d: RutaDirecciones) => ({
      ruta: rutaKey(d.desde, d.hacia),
      origenHash: hashDireccion(d.direccionOrigen),
      destinoHash: hashDireccion(d.direccionDestino),
      dir: d,
    }));
    const cacheadas = await this.repo.cacheados(hashes);

    const out = new Map<string, Computada>();
    const faltan = [];
    for (const h of hashes) {
      const hit = cacheadas.get(rutaKey(h.origenHash, h.destinoHash));
      if (hit) {
        out.set(h.ruta, {
          distancia_km: distanciaKm(hit.distanciaM),
          duracion_taxi_min: duracionTaxiMin(
            hit.duracionS,
            ctx.config.factorTrafico,
          ),
          geocode_confianza: round2(hit.confianza),
        });
      } else {
        faltan.push({
          origenHash: h.origenHash,
          destinoHash: h.destinoHash,
          origenTexto: `${h.dir.direccionOrigen}, ${h.dir.desde}, Peru`,
          destinoTexto: `${h.dir.direccionDestino}, ${h.dir.hacia}, Peru`,
        });
      }
    }
    await this.routing.enqueue(faltan);
    return out;
  }
}
