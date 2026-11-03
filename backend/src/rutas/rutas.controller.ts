import { Controller, Get, Query } from '@nestjs/common';
import { PeriodoQueryDto } from '../periodo/periodo-query.dto.js';
import { siguientePeriodo } from '../periodo/periodo.rules.js';
import { PeriodoService } from '../periodo/periodo.service.js';
import { Presupuesto, RutaItem, RutasService } from './rutas.service.js';

@Controller()
export class RutasController {
  constructor(
    private readonly rutas: RutasService,
    private readonly periodos: PeriodoService,
  ) {}

  @Get('analitica/rutas')
  async getRutas(
    @Query() query: PeriodoQueryDto,
  ): Promise<{ periodo: string; items: RutaItem[] }> {
    const ctx = await this.periodos.context();
    return this.rutas.rutas(this.periodos.resolve(query.periodo, ctx), ctx);
  }

  /** The month being budgeted: next month unless one is given. */
  @Get('presupuesto')
  async getPresupuesto(@Query() query: PeriodoQueryDto): Promise<Presupuesto> {
    const ctx = await this.periodos.context();
    const periodo =
      query.periodo === undefined
        ? siguientePeriodo(ctx.today.slice(0, 7))
        : this.periodos.resolve(query.periodo, ctx);
    return this.rutas.presupuesto(periodo, ctx);
  }
}
