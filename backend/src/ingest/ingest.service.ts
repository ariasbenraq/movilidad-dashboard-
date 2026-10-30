import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { IngestDto } from './ingest.dto.js';
import { heMinutos, periodoOf, reviewReason } from './ingest.rules.js';

export type IngestResult =
  | { status: 'created'; id: number }
  | { status: 'duplicate' };

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async ingest(dto: IngestDto): Promise<IngestResult> {
    const periodo = periodoOf(dto.fecha_form);
    const costo = dto.costo_movilidad ?? 0;
    const otros = dto.otros_gastos ?? 0;
    const heInicio = dto.he_inicio ?? null;
    const heFin = dto.he_fin ?? null;
    const workorder = dto.workorder ?? null;
    const minutos = heMinutos(heInicio, heFin);

    const result = await this.dataSource.transaction(
      async (manager): Promise<IngestResult> => {
        let possibleDuplicate = false;
        if (workorder !== null) {
          // Serializes concurrent inserts of the same expense so the flag is consistent.
          await manager.query(
            `SELECT pg_advisory_xact_lock(hashtext($1))`,
            [`${dto.fecha_form}:${workorder}`],
          );
          const rows: unknown[] = await manager.query(
            `SELECT 1 FROM movilidad_registros
              WHERE gmail_message_id <> $1 AND fecha_form = $2
                AND workorder = $3 AND costo_movilidad = $4::numeric
              LIMIT 1`,
            [dto.gmail_message_id, dto.fecha_form, workorder, costo],
          );
          possibleDuplicate = rows.length > 0;
        }

        const inserted: { id: string }[] = await manager.query(
          `INSERT INTO movilidad_registros (
             gmail_message_id, received_at, fecha_form, periodo,
             costo_movilidad, otros_gastos, otros_detalle,
             he_inicio, he_fin, he_minutos,
             workorder, cliente, tipo_traslado,
             review_reason, parser_version
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (gmail_message_id) DO NOTHING
           RETURNING id`,
          [
            dto.gmail_message_id,
            dto.received_at,
            dto.fecha_form,
            periodo,
            costo,
            otros,
            dto.otros_detalle ?? null,
            heInicio,
            heFin,
            minutos,
            workorder,
            dto.cliente ?? null,
            dto.tipo_traslado ?? null,
            reviewReason({
              costoMovilidad: costo,
              otrosGastos: otros,
              heInicio,
              heFin,
              heMinutos: minutos,
              possibleDuplicate,
            }),
            dto.parser_version,
          ],
        );

        return inserted.length > 0
          ? { status: 'created', id: Number(inserted[0].id) }
          : { status: 'duplicate' };
      },
    );

    if (result.status === 'created') {
      await this.invalidateCache(periodo);
    }
    return result;
  }

  /** Deletes every cache key of the period. Never fails the ingest. */
  private async invalidateCache(periodo: string): Promise<void> {
    try {
      const pattern = `movilidad:v1:${periodo}:*`;
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(
        `Cache invalidation failed for ${periodo}: ${(error as Error).message}`,
      );
    }
  }
}
