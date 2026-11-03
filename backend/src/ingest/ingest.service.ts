import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service.js';
import { canonDistrito } from '../distritos/canon.js';
import { IngestDto } from './ingest.dto.js';
import { heMinutos, periodoOf, reviewReason } from './ingest.rules.js';

export type IngestResult =
  { status: 'created'; id: number } | { status: 'duplicate' };

@Injectable()
export class IngestService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cache: CacheService,
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
          await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
            `${dto.fecha_form}:${workorder}`,
          ]);
          const rows: unknown[] = await manager.query(
            `SELECT 1 FROM movilidad_registros
              WHERE gmail_message_id <> $1 AND fecha_form = $2
                AND workorder = $3 AND costo_movilidad = $4::numeric
              LIMIT 1`,
            [dto.gmail_message_id, dto.fecha_form, workorder, costo],
          );
          possibleDuplicate = rows.length > 0;
        }

        const origen = dto.distrito_origen ?? null;
        const destino = dto.distrito_destino ?? null;
        const [origenCanon, destinoCanon] = await Promise.all([
          canonDistrito(manager, origen),
          canonDistrito(manager, destino),
        ]);
        const unknownDistrict =
          (origen !== null && origenCanon === null) ||
          (destino !== null && destinoCanon === null);

        const inserted: { id: string }[] = await manager.query(
          `INSERT INTO movilidad_registros (
             gmail_message_id, received_at, fecha_form, periodo,
             costo_movilidad, otros_gastos, otros_detalle,
             he_inicio, he_fin, he_minutos,
             workorder, cliente, tipo_traslado,
             distrito_origen, direccion_origen,
             distrito_destino, direccion_destino,
             distrito_origen_canon, distrito_destino_canon, hora_inicio,
             review_reason, parser_version
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
                     $14,$15,$16,$17,$18,$19,$20,$21,$22)
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
            origen,
            dto.direccion_origen ?? null,
            destino,
            dto.direccion_destino ?? null,
            origenCanon,
            destinoCanon,
            dto.hora_inicio ?? null,
            reviewReason({
              costoMovilidad: costo,
              otrosGastos: otros,
              heInicio,
              heFin,
              heMinutos: minutos,
              possibleDuplicate,
              unknownDistrict,
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
      await this.cache.invalidatePeriodo(periodo);
    }
    return result;
  }
}
