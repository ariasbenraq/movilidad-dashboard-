import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { PeriodoService } from './periodo.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [PeriodoService],
  exports: [PeriodoService],
})
export class PeriodoModule {}
