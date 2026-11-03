import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { CacheService } from '../cache/cache.service.js';
import { normalizeDistrito } from '../ingest/ingest.rules.js';
import {
  SinMapear,
  agruparSinMapear,
  textosQueNormalizanA,
} from './distritos.rules.js';

export interface Equivalencia {
  texto_normalizado: string;
  distrito: string;
}

export interface EquivalenciasResponse {
  items: Equivalencia[];
  sin_mapear: SinMapear[];
}

@Injectable()
export class EquivalenciasService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cache: CacheService,
  ) {}

  async list(): Promise<EquivalenciasResponse> {
    const items: Equivalencia[] = await this.dataSource.query(
      `SELECT texto_normalizado, distrito FROM distrito_equivalencias
        ORDER BY texto_normalizado`,
    );
    const usos: { id: string; texto: string }[] = await this.dataSource.query(
      `SELECT id::text AS id, distrito_origen AS texto
         FROM movilidad_registros
        WHERE distrito_origen IS NOT NULL AND distrito_origen_canon IS NULL
       UNION
       SELECT id::text, distrito_destino
         FROM movilidad_registros
        WHERE distrito_destino IS NOT NULL AND distrito_destino_canon IS NULL`,
    );
    return { items, sin_mapear: agruparSinMapear(usos) };
  }

  async upsert(texto: string, distrito: string): Promise<Equivalencia> {
    const key = normalizeDistrito(texto);
    const periodos = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO distrito_equivalencias (texto_normalizado, distrito)
         VALUES ($1, $2)
         ON CONFLICT (texto_normalizado) DO UPDATE SET distrito = EXCLUDED.distrito`,
        [key, distrito],
      );
      return this.rederive(manager, key, distrito);
    });
    await this.invalidate(periodos);
    return { texto_normalizado: key, distrito };
  }

  async remove(textoNormalizado: string): Promise<void> {
    const key = normalizeDistrito(textoNormalizado);
    const periodos = await this.dataSource.transaction(async (manager) => {
      // TypeORM answers UPDATE/DELETE queries as [rows, affectedCount].
      const [deleted]: [unknown[], number] = await manager.query(
        `DELETE FROM distrito_equivalencias WHERE texto_normalizado = $1 RETURNING 1`,
        [key],
      );
      if (deleted.length === 0) {
        throw new NotFoundException('Equivalence not found');
      }
      return this.rederive(manager, key, null);
    });
    await this.invalidate(periodos);
  }

  /**
   * Sets (or clears, with null) the canonical district of every stored record
   * whose text normalizes to `key`, then re-derives their `unknown_district`
   * flag. This is the only update that touches stored rows. Returns the
   * affected periods.
   */
  private async rederive(
    manager: EntityManager,
    key: string,
    canon: string | null,
  ): Promise<string[]> {
    const used: { texto: string }[] = await manager.query(
      `SELECT DISTINCT texto FROM (
         SELECT distrito_origen AS texto FROM movilidad_registros
         UNION ALL
         SELECT distrito_destino FROM movilidad_registros
       ) t WHERE texto IS NOT NULL`,
    );
    const raws = textosQueNormalizanA(
      key,
      used.map((u) => u.texto),
    );
    if (raws.length === 0) return [];

    const [affected]: [{ id: string; periodo: string }[], number] =
      await manager.query(
        `UPDATE movilidad_registros SET
         distrito_origen_canon = CASE WHEN distrito_origen = ANY($2::text[])
           THEN $1::text ELSE distrito_origen_canon END,
         distrito_destino_canon = CASE WHEN distrito_destino = ANY($2::text[])
           THEN $1::text ELSE distrito_destino_canon END
       WHERE distrito_origen = ANY($2::text[])
          OR distrito_destino = ANY($2::text[])
       RETURNING id::text AS id, periodo`,
        [canon, raws],
      );

    // unknown_district is the last code in the fixed order, so it is stripped
    // and re-appended without disturbing the others.
    await manager.query(
      `UPDATE movilidad_registros m SET review_reason = x.nuevo
         FROM (
           SELECT id,
             CASE WHEN (distrito_origen IS NOT NULL AND distrito_origen_canon IS NULL)
                    OR (distrito_destino IS NOT NULL AND distrito_destino_canon IS NULL)
                  THEN concat_ws(',', base, 'unknown_district')
                  ELSE base END AS nuevo
             FROM (
               SELECT id, distrito_origen, distrito_origen_canon,
                      distrito_destino, distrito_destino_canon,
                      NULLIF(array_to_string(array_remove(
                        string_to_array(COALESCE(review_reason, ''), ','),
                        'unknown_district'), ','), '') AS base
                 FROM movilidad_registros
                WHERE id = ANY($1::bigint[])
             ) s
         ) x
        WHERE m.id = x.id`,
      [affected.map((a) => a.id)],
    );
    return [...new Set(affected.map((a) => a.periodo))];
  }

  /** Affected periods change in /resumen and /registros; year totals span periods. */
  private async invalidate(periodos: string[]): Promise<void> {
    await Promise.all([
      ...periodos.map((p) => this.cache.invalidatePeriodo(p)),
      this.cache.invalidateDistritos(),
    ]);
  }
}
