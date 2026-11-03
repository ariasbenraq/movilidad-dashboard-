import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { cacheKeys } from '../cache/cache.keys.js';
import { CacheService } from '../cache/cache.service.js';
import { isRealDate } from '../ingest/ingest.rules.js';
import { PeriodoContext, PeriodoService } from '../periodo/periodo.service.js';
import { RegistrosQueryDto } from './registros.dto.js';

export interface Lugar {
  distrito: string | null;
  distrito_canon: string | null;
  direccion: string | null;
}

export interface RegistroItem {
  id: number;
  fecha: string;
  hora_inicio: string | null;
  workorder: string | null;
  cliente: string | null;
  desde: Lugar;
  hacia: Lugar;
  costo_movilidad: number;
  otros_gastos: number;
  otros_detalle: string | null;
  total: number;
  he_inicio: string | null;
  he_fin: string | null;
  he_minutos: number;
  needs_review: boolean;
  review_reason: string | null;
}

export interface RegistrosPage {
  items: RegistroItem[];
  page: number;
  limit: number;
  total: number;
}

interface Row {
  id: string;
  fecha: string;
  hora_inicio: string | null;
  workorder: string | null;
  cliente: string | null;
  distrito_origen: string | null;
  distrito_origen_canon: string | null;
  direccion_origen: string | null;
  distrito_destino: string | null;
  distrito_destino_canon: string | null;
  direccion_destino: string | null;
  costo: string;
  otros: string;
  otros_detalle: string | null;
  he_inicio: string | null;
  he_fin: string | null;
  he_minutos: number;
  needs_review: boolean;
  review_reason: string | null;
}

const COLUMNS = `
  id,
  to_char(fecha_form, 'YYYY-MM-DD') AS fecha,
  to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
  workorder, cliente,
  distrito_origen, distrito_origen_canon, direccion_origen,
  distrito_destino, distrito_destino_canon, direccion_destino,
  (costo_movilidad * 100)::bigint AS costo,
  (otros_gastos * 100)::bigint AS otros,
  otros_detalle,
  to_char(he_inicio, 'HH24:MI') AS he_inicio,
  to_char(he_fin, 'HH24:MI') AS he_fin,
  he_minutos, needs_review, review_reason`;

@Injectable()
export class RegistrosService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cache: CacheService,
    private readonly periodos: PeriodoService,
  ) {}

  async list(
    query: RegistrosQueryDto,
    ctx: PeriodoContext,
  ): Promise<RegistrosPage> {
    const range = this.rangeOf(query);
    const filtered =
      query.cliente !== undefined ||
      query.workorder !== undefined ||
      query.por_revisar !== undefined;

    // Only the plain "one period, no filters" listing has a cache key (spec section 8).
    if (range === null && !filtered) {
      const periodo = this.periodos.resolve(query.periodo, ctx);
      return this.cache.wrap(
        cacheKeys.registros(periodo, query.page, query.limit),
        () => this.query({ periodo }, query),
      );
    }
    return this.query(
      range ?? { periodo: this.periodos.resolve(query.periodo, ctx) },
      query,
    );
  }

  /** The desde/hasta range, or null when a periodo (explicit or default) applies. */
  private rangeOf(
    query: RegistrosQueryDto,
  ): { desde: string; hasta: string } | null {
    if (query.periodo !== undefined) return null; // periodo wins
    const { desde, hasta } = query;
    if (desde === undefined && hasta === undefined) return null;
    if (desde === undefined || hasta === undefined) {
      throw new BadRequestException('desde and hasta must be sent together');
    }
    if (!isRealDate(desde) || !isRealDate(hasta)) {
      throw new BadRequestException('desde and hasta must be real dates');
    }
    if (desde > hasta) {
      throw new BadRequestException('desde must not be after hasta');
    }
    return { desde, hasta };
  }

  private async query(
    scope: { periodo: string } | { desde: string; hasta: string },
    query: RegistrosQueryDto,
  ): Promise<RegistrosPage> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };

    if ('periodo' in scope) add('periodo = ?', scope.periodo);
    else {
      add('fecha_form >= ?', scope.desde);
      add('fecha_form <= ?', scope.hasta);
    }
    if (query.cliente !== undefined) add('cliente = ?', query.cliente);
    if (query.workorder !== undefined) add('workorder = ?', query.workorder);
    if (query.por_revisar === true) where.push('needs_review');

    const clause = `WHERE ${where.join(' AND ')}`;
    const [{ total }]: { total: number }[] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM movilidad_registros ${clause}`,
      params,
    );
    const rows: Row[] = await this.dataSource.query(
      `SELECT ${COLUMNS}
         FROM movilidad_registros ${clause}
        ORDER BY fecha_form DESC, hora_inicio DESC NULLS LAST, id DESC
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
      params,
    );

    return {
      items: rows.map(toItem),
      page: query.page,
      limit: query.limit,
      total,
    };
  }
}

function toItem(r: Row): RegistroItem {
  const costo = Number(r.costo);
  const otros = Number(r.otros);
  return {
    id: Number(r.id),
    fecha: r.fecha,
    hora_inicio: r.hora_inicio,
    workorder: r.workorder,
    cliente: r.cliente,
    desde: {
      distrito: r.distrito_origen,
      distrito_canon: r.distrito_origen_canon,
      direccion: r.direccion_origen,
    },
    hacia: {
      distrito: r.distrito_destino,
      distrito_canon: r.distrito_destino_canon,
      direccion: r.direccion_destino,
    },
    costo_movilidad: costo / 100,
    otros_gastos: otros / 100,
    otros_detalle: r.otros_detalle,
    total: (costo + otros) / 100,
    he_inicio: r.he_inicio,
    he_fin: r.he_fin,
    he_minutos: r.he_minutos,
    needs_review: r.needs_review,
    review_reason: r.review_reason,
  };
}
