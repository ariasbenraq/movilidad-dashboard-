import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PeriodoModule } from '../periodo/periodo.module.js';
import { ResumenController } from './resumen.controller.js';
import { ResumenService } from './resumen.service.js';

@Module({
  imports: [DatabaseModule, CacheModule, PeriodoModule],
  controllers: [ResumenController],
  providers: [ResumenService],
})
export class ResumenModule {}
