import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
} from '@nestjs/common';
import { UpsertEquivalenciaDto } from './equivalencias.dto.js';
import {
  Equivalencia,
  EquivalenciasResponse,
  EquivalenciasService,
} from './equivalencias.service.js';

@Controller('distritos/equivalencias')
export class EquivalenciasController {
  constructor(private readonly equivalencias: EquivalenciasService) {}

  @Get()
  list(): Promise<EquivalenciasResponse> {
    return this.equivalencias.list();
  }

  @Put()
  upsert(@Body() dto: UpsertEquivalenciaDto): Promise<Equivalencia> {
    return this.equivalencias.upsert(dto.texto, dto.distrito);
  }

  @Delete(':texto_normalizado')
  @HttpCode(204)
  remove(@Param('texto_normalizado') texto: string): Promise<void> {
    return this.equivalencias.remove(texto);
  }
}
