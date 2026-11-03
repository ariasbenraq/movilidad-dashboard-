import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module.js';
import { PeriodoModule } from '../periodo/periodo.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { OrsClient } from './ors.client.js';
import {
  DEFAULT_ROUTING_DELAY_MS,
  ROUTING_DELAY_MS,
  ROUTING_PROVIDER,
} from './routing.provider.js';
import { RutasController } from './rutas.controller.js';
import { RutasRepository } from './rutas.repository.js';
import { RutasRoutingService } from './rutas-routing.service.js';
import { RutasService } from './rutas.service.js';

@Module({
  imports: [DatabaseModule, PeriodoModule, RedisModule],
  controllers: [RutasController],
  providers: [
    RutasRepository,
    RutasRoutingService,
    RutasService,
    { provide: ROUTING_DELAY_MS, useValue: DEFAULT_ROUTING_DELAY_MS },
    {
      provide: ROUTING_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new OrsClient(config.get<string>('ORS_API_KEY'));
        if (!client.enabled) {
          new Logger('Rutas').warn(
            'ORS_API_KEY is not set: route distances and times stay null',
          );
        }
        return client;
      },
    },
  ],
})
export class RutasModule {}
