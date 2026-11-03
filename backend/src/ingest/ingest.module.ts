import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CacheModule } from '../cache/cache.module.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { IngestController } from './ingest.controller.js';
import { IngestService } from './ingest.service.js';

@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [IngestController],
  providers: [IngestService, ApiKeyGuard],
})
export class IngestModule {}
