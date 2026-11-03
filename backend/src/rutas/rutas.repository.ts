import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { rutaKey } from './rutas.rules.js';

export interface RutaViajes {
  desde: string;
  hacia: string;
  viajes: number;
  costoCents: number;
}

export interface RutaDirecciones {
  desde: string;
  hacia: string;
  direccionOrigen: string;
  direccionDestino: string;
}

export interface BusAgregado {
  desde: string;
  hacia: string;
  entradas: number;
  costoCents: number;
  duracionMin: number | null;
}

export interface RutaCacheada {
  origenHash: string;
  destinoHash: string;
  distanciaM: number;
  duracionS: number;
  confianza: number;
}

@Injectable()
export class RutasRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Trips and taxi cost per canonical route. Records with an unmapped end are left out. */
  async viajesPorRuta(periodos: string[]): Promise<RutaViajes[]> {
    if (periodos.length === 0) return [];
    const rows: {
      desde: string;
      hacia: string;
      viajes: number;
      costo: string;
    }[] = await this.dataSource.query(
      `SELECT distrito_origen_canon AS desde, distrito_destino_canon AS hacia,
              COUNT(*)::int AS viajes,
              (SUM(costo_movilidad) * 100)::bigint AS costo
         FROM movilidad_registros
        WHERE periodo = ANY($1::text[])
          AND distrito_origen_canon IS NOT NULL
          AND distrito_destino_canon IS NOT NULL
        GROUP BY 1, 2
        ORDER BY viajes DESC, desde, hacia`,
      [periodos],
    );
    return rows.map((r) => ({
      desde: r.desde,
      hacia: r.hacia,
      viajes: r.viajes,
      costoCents: Number(r.costo),
    }));
  }

  /** The most frequent (then most recent) address pair of each canonical route. */
  async direccionesPorRuta(periodos: string[]): Promise<RutaDirecciones[]> {
    if (periodos.length === 0) return [];
    const rows: {
      desde: string;
      hacia: string;
      direccion_origen: string;
      direccion_destino: string;
    }[] = await this.dataSource.query(
      `SELECT DISTINCT ON (desde, hacia) desde, hacia, direccion_origen, direccion_destino
         FROM (
           SELECT distrito_origen_canon AS desde, distrito_destino_canon AS hacia,
                  direccion_origen, direccion_destino,
                  COUNT(*) AS veces, MAX(fecha_form) AS ultima
             FROM movilidad_registros
            WHERE periodo = ANY($1::text[])
              AND distrito_origen_canon IS NOT NULL
              AND distrito_destino_canon IS NOT NULL
              AND direccion_origen IS NOT NULL
              AND direccion_destino IS NOT NULL
            GROUP BY 1, 2, 3, 4
         ) t
        ORDER BY desde, hacia, veces DESC, ultima DESC`,
      [periodos],
    );
    return rows.map((r) => ({
      desde: r.desde,
      hacia: r.hacia,
      direccionOrigen: r.direccion_origen,
      direccionDestino: r.direccion_destino,
    }));
  }

  /** Bus expenses of every route, from the start of the history up to (excluding) `antesDe`. */
  async busPorRuta(antesDe: string): Promise<BusAgregado[]> {
    const rows: {
      desde: string;
      hacia: string;
      entradas: number;
      costo: string;
      duracion: string | null;
    }[] = await this.dataSource.query(
      `SELECT distrito_origen_canon AS desde, distrito_destino_canon AS hacia,
              COUNT(*)::int AS entradas,
              (SUM(costo) * 100)::bigint AS costo,
              AVG(duracion_min)::float8 AS duracion
         FROM bus_gastos
        WHERE fecha < $1::date
          AND distrito_origen_canon IS NOT NULL
          AND distrito_destino_canon IS NOT NULL
        GROUP BY 1, 2`,
      [`${antesDe}-01`],
    );
    return rows.map((r) => ({
      desde: r.desde,
      hacia: r.hacia,
      entradas: r.entradas,
      costoCents: Number(r.costo),
      duracionMin: r.duracion === null ? null : Math.round(Number(r.duracion)),
    }));
  }

  /** Month of the oldest stored record, or null when there are none. */
  async primerPeriodo(): Promise<string | null> {
    const rows: { periodo: string | null }[] = await this.dataSource.query(
      `SELECT MIN(periodo) AS periodo FROM movilidad_registros`,
    );
    return rows[0].periodo;
  }

  async cacheados(
    pares: { origenHash: string; destinoHash: string }[],
  ): Promise<Map<string, RutaCacheada>> {
    if (pares.length === 0) return new Map();
    const rows: {
      origen_hash: string;
      destino_hash: string;
      distancia_m: number;
      duracion_s: number;
      confianza: number;
    }[] = await this.dataSource.query(
      `SELECT c.origen_hash, c.destino_hash, c.distancia_m, c.duracion_s,
              c.geocode_confianza::float8 AS confianza
         FROM rutas_cache c
         JOIN unnest($1::text[], $2::text[]) AS k(o, d)
           ON c.origen_hash = k.o AND c.destino_hash = k.d`,
      [pares.map((p) => p.origenHash), pares.map((p) => p.destinoHash)],
    );
    return new Map(
      rows.map((r) => [
        rutaKey(r.origen_hash, r.destino_hash),
        {
          origenHash: r.origen_hash,
          destinoHash: r.destino_hash,
          distanciaM: r.distancia_m,
          duracionS: r.duracion_s,
          confianza: r.confianza,
        },
      ]),
    );
  }

  async guardar(
    origenHash: string,
    destinoHash: string,
    distanciaM: number,
    duracionS: number,
    confianza: number,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO rutas_cache
         (origen_hash, destino_hash, distancia_m, duracion_s, geocode_confianza)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (origen_hash, destino_hash) DO UPDATE SET
         distancia_m = EXCLUDED.distancia_m, duracion_s = EXCLUDED.duracion_s,
         geocode_confianza = EXCLUDED.geocode_confianza, fetched_at = now()`,
      [origenHash, destinoHash, distanciaM, duracionS, confianza],
    );
  }
}
