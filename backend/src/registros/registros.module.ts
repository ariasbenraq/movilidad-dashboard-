import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PeriodoModule } from '../periodo/periodo.module.js';
import { RegistrosController } from './registros.controller.js';
import { RegistrosService } from './registros.service.js';

@Module({
  imports: [DatabaseModule, CacheModule, PeriodoModule],
  controllers: [RegistrosController],
  providers: [RegistrosService],
})
export class RegistrosModule {}
