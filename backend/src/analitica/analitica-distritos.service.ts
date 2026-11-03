import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { cacheKeys } from '../cache/cache.keys.js';
import { CacheService } from '../cache/cache.service.js';
import {
  mesesRestantes,
  visitasAnioEstimadas,
} from '../distritos/distritos.rules.js';

export interface DistritoAnalitica {
  distrito: string | null;
  visitas: number;
  costo_total: number;
  costo_promedio: number;
  clientes: { cliente: string; visitas: number }[];
  workorders: { workorder: string; visitas: number }[];
  visitas_anio_hasta_hoy: number;
  meses_restantes: number;
  visitas_anio_estimadas: number;
}

const MAX_WORKORDERS = 10;
const NULL_KEY = '\u0000';
const keyOf = (distrito: string | null) => distrito ?? NULL_KEY;

interface Count {
  distrito: string | null;
  visitas: number;
}

@Injectable()
export class AnaliticaDistritosService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cache: CacheService,
  ) {}

  distritos(
    periodo: string,
  ): Promise<{ periodo: string; items: DistritoAnalitica[] }> {
    return this.cache.wrap(cacheKeys.distritos(periodo), async () => {
      const [mes, anio, clientes, workorders]: [
        (Count & { costo: string })[],
        Count[],
        (Count & { cliente: string })[],
        (Count & { workorder: string })[],
      ] = await Promise.all([
        this.dataSource.query(
          `SELECT distrito_destino_canon AS distrito, COUNT(*)::int AS visitas,
                  (SUM(costo_movilidad) * 100)::bigint AS costo
             FROM movilidad_registros WHERE periodo = $1
            GROUP BY distrito_destino_canon`,
          [periodo],
        ),
        // Visits from January 1 through the end of the requested period.
        this.dataSource.query(
          `SELECT distrito_destino_canon AS distrito, COUNT(*)::int AS visitas
             FROM movilidad_registros
            WHERE periodo >= $2 AND periodo <= $1
            GROUP BY distrito_destino_canon`,
          [periodo, `${periodo.slice(0, 4)}-01`],
        ),
        this.dataSource.query(
          `SELECT distrito_destino_canon AS distrito, cliente, COUNT(*)::int AS visitas
             FROM movilidad_registros
            WHERE periodo = $1 AND cliente IS NOT NULL
            GROUP BY distrito_destino_canon, cliente`,
          [periodo],
        ),
        this.dataSource.query(
          `SELECT distrito_destino_canon AS distrito, workorder, COUNT(*)::int AS visitas
             FROM movilidad_registros
            WHERE periodo = $1 AND workorder IS NOT NULL
            GROUP BY distrito_destino_canon, workorder`,
          [periodo],
        ),
      ]);

      const anioPorDistrito = new Map(
        anio.map((r) => [keyOf(r.distrito), r.visitas]),
      );
      const meses = mesesRestantes(periodo);
      const byVisitas = <T extends { visitas: number }>(
        a: T,
        b: T,
        name: (t: T) => string,
      ) => b.visitas - a.visitas || name(a).localeCompare(name(b));

      const items = mes.map((m): DistritoAnalitica => {
        const costo = Number(m.costo);
        const hastaHoy = anioPorDistrito.get(keyOf(m.distrito)) ?? m.visitas;
        return {
          distrito: m.distrito,
          visitas: m.visitas,
          costo_total: costo / 100,
          costo_promedio: Math.round(costo / m.visitas) / 100,
          clientes: clientes
            .filter((c) => keyOf(c.distrito) === keyOf(m.distrito))
            .map((c) => ({ cliente: c.cliente, visitas: c.visitas }))
            .sort((a, b) => byVisitas(a, b, (x) => x.cliente)),
          workorders: workorders
            .filter((w) => keyOf(w.distrito) === keyOf(m.distrito))
            .map((w) => ({ workorder: w.workorder, visitas: w.visitas }))
            .sort((a, b) => byVisitas(a, b, (x) => x.workorder))
            .slice(0, MAX_WORKORDERS),
          visitas_anio_hasta_hoy: hastaHoy,
          meses_restantes: meses,
          visitas_anio_estimadas: visitasAnioEstimadas(
            hastaHoy,
            m.visitas,
            meses,
          ),
        };
      });
      items.sort(
        (a, b) =>
          b.visitas - a.visitas ||
          (a.distrito ?? '￿').localeCompare(b.distrito ?? '￿'),
      );
      return { periodo, items };
    });
  }
}
