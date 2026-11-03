import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { PeriodoQueryDto } from '../periodo/periodo-query.dto.js';
import { PeriodoService } from '../periodo/periodo.service.js';
import { BusGastoDto } from './bus-gasto.dto.js';
import { BusGastoItem, BusGastosService } from './bus-gastos.service.js';

// The global pipe strips unknown fields silently; a hand-typed form should reject
// them instead (a typo like "duracion" would otherwise vanish). Typing the body as
// `object` makes the global pipe skip it, so this pipe validates (same as /ingest).
const busPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  expectedType: BusGastoDto,
  validationError: { target: false, value: false },
});

@Controller('bus-gastos')
export class BusGastosController {
  constructor(
    private readonly busGastos: BusGastosService,
    private readonly periodos: PeriodoService,
  ) {}

  @Post()
  create(@Body(busPipe) body: object): Promise<{ id: number }> {
    return this.busGastos.create(body as BusGastoDto);
  }

  @Get()
  async list(
    @Query() query: PeriodoQueryDto,
  ): Promise<{ items: BusGastoItem[] }> {
    const ctx = await this.periodos.context();
    return this.busGastos.list(this.periodos.resolve(query.periodo, ctx));
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(busPipe) body: object,
  ): Promise<BusGastoItem> {
    return this.busGastos.update(id, body as BusGastoDto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.busGastos.remove(id);
  }
}
