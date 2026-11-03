import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { canonDistrito } from '../distritos/canon.js';
import { BusGastoDto } from './bus-gasto.dto.js';

export interface Lugar {
  distrito: string;
  distrito_canon: string | null;
}

export interface BusGastoItem {
  id: number;
  fecha: string;
  desde: Lugar;
  hacia: Lugar;
  costo: number;
  duracion_min: number | null;
  nota: string | null;
}

interface Row {
  id: string;
  fecha: string;
  distrito_origen: string;
  distrito_origen_canon: string | null;
  distrito_destino: string;
  distrito_destino_canon: string | null;
  costo: string;
  duracion_min: number | null;
  nota: string | null;
}

const COLUMNS = `
  id::text AS id,
  to_char(fecha, 'YYYY-MM-DD') AS fecha,
  distrito_origen, distrito_origen_canon,
  distrito_destino, distrito_destino_canon,
  (costo * 100)::bigint AS costo,
  duracion_min, nota`;

@Injectable()
export class BusGastosService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(dto: BusGastoDto): Promise<{ id: number }> {
    const [origenCanon, destinoCanon] = await this.canons(dto);
    const rows: { id: string }[] = await this.dataSource.query(
      `INSERT INTO bus_gastos (
         fecha, distrito_origen, distrito_destino,
         distrito_origen_canon, distrito_destino_canon,
         costo, duracion_min, nota
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id::text AS id`,
      [
        dto.fecha,
        dto.desde,
        dto.hacia,
        origenCanon,
        destinoCanon,
        dto.costo,
        dto.duracion_min ?? null,
        dto.nota ?? null,
      ],
    );
    return { id: Number(rows[0].id) };
  }

  async list(periodo: string): Promise<{ items: BusGastoItem[] }> {
    const rows: Row[] = await this.dataSource.query(
      `SELECT ${COLUMNS} FROM bus_gastos
        WHERE to_char(fecha, 'YYYY-MM') = $1
        ORDER BY fecha DESC, id DESC`,
      [periodo],
    );
    return { items: rows.map(toItem) };
  }

  async update(id: number, dto: BusGastoDto): Promise<BusGastoItem> {
    this.assertId(id);
    const [origenCanon, destinoCanon] = await this.canons(dto);
    // TypeORM answers UPDATE/DELETE queries as [rows, affectedCount].
    const [rows]: [Row[], number] = await this.dataSource.query(
      `UPDATE bus_gastos SET
         fecha = $2, distrito_origen = $3, distrito_destino = $4,
         distrito_origen_canon = $5, distrito_destino_canon = $6,
         costo = $7, duracion_min = $8, nota = $9
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [
        id,
        dto.fecha,
        dto.desde,
        dto.hacia,
        origenCanon,
        destinoCanon,
        dto.costo,
        dto.duracion_min ?? null,
        dto.nota ?? null,
      ],
    );
    if (rows.length === 0) throw new NotFoundException('Bus expense not found');
    return toItem(rows[0]);
  }

  async remove(id: number): Promise<void> {
    this.assertId(id);
    const [rows]: [unknown[], number] = await this.dataSource.query(
      `DELETE FROM bus_gastos WHERE id = $1 RETURNING 1`,
      [id],
    );
    if (rows.length === 0) throw new NotFoundException('Bus expense not found');
  }

  /** An id that cannot be a bigint can never exist: 404 instead of a database error. */
  private assertId(id: number): void {
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new NotFoundException('Bus expense not found');
    }
  }

  private canons(dto: BusGastoDto): Promise<[string | null, string | null]> {
    const manager = this.dataSource.manager;
    return Promise.all([
      canonDistrito(manager, dto.desde),
      canonDistrito(manager, dto.hacia),
    ]);
  }
}

function toItem(r: Row): BusGastoItem {
  return {
    id: Number(r.id),
    fecha: r.fecha,
    desde: {
      distrito: r.distrito_origen,
      distrito_canon: r.distrito_origen_canon,
    },
    hacia: {
      distrito: r.distrito_destino,
      distrito_canon: r.distrito_destino_canon,
    },
    costo: Number(r.costo) / 100,
    duracion_min: r.duracion_min,
    nota: r.nota,
  };
}
