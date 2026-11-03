import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { cacheKeys } from '../cache/cache.keys.js';
import { CacheService } from '../cache/cache.service.js';
import { PeriodoContext } from '../periodo/periodo.service.js';
import {
  diasDelMes,
  diasLaborablesRestantes,
  diasTranscurridos,
  esCerrado,
  fechaPago,
  horasExtraMonto,
  proyectar,
  toIsoInZone,
} from '../periodo/periodo.rules.js';

export interface Resumen {
  periodo: string;
  cerrado: boolean;
  total: number;
  costo_movilidad: number;
  otros_gastos: number;
  registros: number;
  por_revisar: number;
  horas_extra_minutos: number;
  horas_extra_monto: number | null;
  ultimo_registro_at: string | null;
  fecha_pago: string;
}

export interface Proyeccion {
  periodo: string;
  cerrado: boolean;
  acumulado: number;
  promedio_diario: number;
  dias_con_gasto: number;
  dias_laborables_restantes: number;
  proyectado: number;
  muestra_insuficiente: boolean;
  progreso: number;
  dias_transcurridos: number;
  dias_del_mes: number;
  fecha_pago: string;
  horas_extra_minutos: number;
  horas_extra_monto: number | null;
}

export interface DiarioItem {
  fecha: string;
  costo_movilidad: number;
  otros_gastos: number;
  total: number;
  registros: number;
  acumulado: number;
}

interface Totales {
  costo: string;
  otros: string;
  registros: number;
  por_revisar: number;
  he_minutos: number;
  ultimo: Date | null;
  dias_con_gasto: number;
}

interface DiarioRow {
  fecha: string;
  costo: string;
  otros: string;
  registros: number;
}

@Injectable()
export class ResumenService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cache: CacheService,
  ) {}

  resumen(periodo: string, ctx: PeriodoContext): Promise<Resumen> {
    return this.cache.wrap(cacheKeys.resumen(periodo), async () => {
      const t = await this.totales(periodo);
      const costo = Number(t.costo);
      const otros = Number(t.otros);
      return {
        periodo,
        cerrado: esCerrado(periodo, ctx.today),
        total: (costo + otros) / 100,
        costo_movilidad: costo / 100,
        otros_gastos: otros / 100,
        registros: t.registros,
        por_revisar: t.por_revisar,
        horas_extra_minutos: t.he_minutos,
        horas_extra_monto: horasExtraMonto(
          t.he_minutos,
          ctx.config.tarifaHoraExtra,
        ),
        ultimo_registro_at: t.ultimo
          ? toIsoInZone(t.ultimo, ctx.config.timezone)
          : null,
        fecha_pago: fechaPago(periodo, ctx.config, ctx.feriados),
      };
    });
  }

  proyeccion(periodo: string, ctx: PeriodoContext): Promise<Proyeccion> {
    return this.cache.wrap(
      cacheKeys.proyeccion(periodo, ctx.today),
      async () => {
        const t = await this.totales(periodo);
        const cerrado = esCerrado(periodo, ctx.today);
        const p = proyectar({
          acumuladoCents: Number(t.costo) + Number(t.otros),
          diasConGasto: t.dias_con_gasto,
          diasLaborablesRestantes: diasLaborablesRestantes(
            periodo,
            ctx.today,
            ctx.config,
            ctx.feriados,
          ),
          cerrado,
        });
        return {
          periodo,
          cerrado,
          ...p,
          dias_transcurridos: diasTranscurridos(periodo, ctx.today),
          dias_del_mes: diasDelMes(periodo),
          fecha_pago: fechaPago(periodo, ctx.config, ctx.feriados),
          horas_extra_minutos: t.he_minutos,
          horas_extra_monto: horasExtraMonto(
            t.he_minutos,
            ctx.config.tarifaHoraExtra,
          ),
        };
      },
    );
  }

  diario(periodo: string): Promise<{ periodo: string; items: DiarioItem[] }> {
    return this.cache.wrap(cacheKeys.diario(periodo), async () => {
      const rows: DiarioRow[] = await this.dataSource.query(
        `SELECT to_char(fecha_form, 'YYYY-MM-DD') AS fecha,
                (SUM(costo_movilidad) * 100)::bigint AS costo,
                (SUM(otros_gastos) * 100)::bigint AS otros,
                COUNT(*)::int AS registros
           FROM movilidad_registros
          WHERE periodo = $1
          GROUP BY fecha_form
          ORDER BY fecha_form`,
        [periodo],
      );
      let acumulado = 0;
      const items = rows.map((r): DiarioItem => {
        const costo = Number(r.costo);
        const otros = Number(r.otros);
        acumulado += costo + otros;
        return {
          fecha: r.fecha,
          costo_movilidad: costo / 100,
          otros_gastos: otros / 100,
          total: (costo + otros) / 100,
          registros: r.registros,
          acumulado: acumulado / 100,
        };
      });
      return { periodo, items };
    });
  }

  /** Sums in integer cents so no float is involved in the database math. */
  private async totales(periodo: string): Promise<Totales> {
    const rows: Totales[] = await this.dataSource.query(
      `SELECT (COALESCE(SUM(costo_movilidad), 0) * 100)::bigint AS costo,
              (COALESCE(SUM(otros_gastos), 0) * 100)::bigint AS otros,
              COUNT(*)::int AS registros,
              (COUNT(*) FILTER (WHERE needs_review))::int AS por_revisar,
              COALESCE(SUM(he_minutos), 0)::int AS he_minutos,
              MAX(received_at) AS ultimo,
              (SELECT COUNT(*)::int FROM (
                 SELECT 1 FROM movilidad_registros WHERE periodo = $1
                  GROUP BY fecha_form
                 HAVING SUM(costo_movilidad + otros_gastos) > 0
               ) dias) AS dias_con_gasto
         FROM movilidad_registros
        WHERE periodo = $1`,
      [periodo],
    );
    return rows[0];
  }
}
