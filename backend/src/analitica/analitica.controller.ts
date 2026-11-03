import { Controller, Get, Query } from '@nestjs/common';
import { PeriodoQueryDto } from '../periodo/periodo-query.dto.js';
import { PeriodoService } from '../periodo/periodo.service.js';
import {
  AnaliticaDistritosService,
  DistritoAnalitica,
} from './analitica-distritos.service.js';

@Controller('analitica')
export class AnaliticaController {
  constructor(
    private readonly distritos: AnaliticaDistritosService,
    private readonly periodos: PeriodoService,
  ) {}

  @Get('distritos')
  async getDistritos(
    @Query() query: PeriodoQueryDto,
  ): Promise<{ periodo: string; items: DistritoAnalitica[] }> {
    const ctx = await this.periodos.context();
    return this.distritos.distritos(this.periodos.resolve(query.periodo, ctx));
  }
}
