import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { todayIn } from '../ingest/ingest.rules.js';
import { PeriodoConfig, parseConfig } from './periodo.rules.js';

export interface PeriodoContext {
  config: PeriodoConfig;
  feriados: ReadonlySet<string>;
  /** Today as YYYY-MM-DD in the configured time zone. */
  today: string;
}

@Injectable()
export class PeriodoService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async context(now: Date = new Date()): Promise<PeriodoContext> {
    const [configRows, feriadoRows]: [
      { key: string; value: string }[],
      { fecha: string }[],
    ] = await Promise.all([
      this.dataSource.query(`SELECT key, value FROM config`),
      this.dataSource.query(
        `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha FROM feriados`,
      ),
    ]);
    const config = parseConfig(configRows);
    return {
      config,
      feriados: new Set(feriadoRows.map((r) => r.fecha)),
      today: todayIn(config.timezone, now),
    };
  }

  /** The requested period, or the current month in the configured zone. */
  resolve(periodo: string | undefined, ctx: PeriodoContext): string {
    if (periodo === undefined) return ctx.today.slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      throw new BadRequestException('periodo must be YYYY-MM');
    }
    return periodo;
  }
}
