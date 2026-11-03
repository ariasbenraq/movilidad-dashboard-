import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PeriodoModule } from '../periodo/periodo.module.js';
import { AnaliticaController } from './analitica.controller.js';
import { AnaliticaDistritosService } from './analitica-distritos.service.js';

@Module({
  imports: [DatabaseModule, CacheModule, PeriodoModule],
  controllers: [AnaliticaController],
  providers: [AnaliticaDistritosService],
})
export class AnaliticaModule {}
