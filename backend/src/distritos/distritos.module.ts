import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EquivalenciasController } from './equivalencias.controller.js';
import { EquivalenciasService } from './equivalencias.service.js';

@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [EquivalenciasController],
  providers: [EquivalenciasService],
})
export class DistritosModule {}
