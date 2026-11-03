import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { PeriodoModule } from '../periodo/periodo.module.js';
import { BusGastosController } from './bus-gastos.controller.js';
import { BusGastosService } from './bus-gastos.service.js';

@Module({
  imports: [DatabaseModule, PeriodoModule],
  controllers: [BusGastosController],
  providers: [BusGastosService],
})
export class BusGastosModule {}
