import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { fileURLToPath } from 'node:url';
import { envValidationSchema } from './config/env.validation.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { ResumenModule } from './resumen/resumen.module.js';
import { IngestModule } from './ingest/ingest.module.js';
import { RegistrosModule } from './registros/registros.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: fileURLToPath(new URL('../../.env', import.meta.url)),
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    AuthModule,
    RedisModule,
    HealthModule,
    IngestModule,
    ResumenModule,
    RegistrosModule,
  ],
})
export class AppModule {}
