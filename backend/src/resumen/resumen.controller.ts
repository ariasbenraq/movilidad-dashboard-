import { Controller, Get, Query } from '@nestjs/common';
import { PeriodoQueryDto } from '../periodo/periodo-query.dto.js';
import { PeriodoService } from '../periodo/periodo.service.js';
import {
  DiarioItem,
  Proyeccion,
  Resumen,
  ResumenService,
} from './resumen.service.js';

@Controller()
export class ResumenController {
  constructor(
    private readonly resumen: ResumenService,
    private readonly periodos: PeriodoService,
  ) {}

  @Get('resumen')
  async getResumen(@Query() query: PeriodoQueryDto): Promise<Resumen> {
    const ctx = await this.periodos.context();
    return this.resumen.resumen(this.periodos.resolve(query.periodo, ctx), ctx);
  }

  @Get('proyeccion')
  async getProyeccion(@Query() query: PeriodoQueryDto): Promise<Proyeccion> {
    const ctx = await this.periodos.context();
    return this.resumen.proyeccion(
      this.periodos.resolve(query.periodo, ctx),
      ctx,
    );
  }

  @Get('diario')
  async getDiario(
    @Query() query: PeriodoQueryDto,
  ): Promise<{ periodo: string; items: DiarioItem[] }> {
    const ctx = await this.periodos.context();
    return this.resumen.diario(this.periodos.resolve(query.periodo, ctx));
  }
}
