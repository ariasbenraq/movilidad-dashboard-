import { Controller, Get, Query } from '@nestjs/common';
import { PeriodoService } from '../periodo/periodo.service.js';
import { RegistrosQueryDto } from './registros.dto.js';
import { RegistrosPage, RegistrosService } from './registros.service.js';

@Controller('registros')
export class RegistrosController {
  constructor(
    private readonly registros: RegistrosService,
    private readonly periodos: PeriodoService,
  ) {}

  @Get()
  async list(@Query() query: RegistrosQueryDto): Promise<RegistrosPage> {
    return this.registros.list(query, await this.periodos.context());
  }
}
