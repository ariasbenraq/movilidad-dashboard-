import { IsOptional, Matches } from 'class-validator';
import { PERIODO_RE } from './periodo.rules.js';

export class PeriodoQueryDto {
  @IsOptional()
  @Matches(PERIODO_RE, { message: 'periodo must be YYYY-MM' })
  periodo?: string;
}
