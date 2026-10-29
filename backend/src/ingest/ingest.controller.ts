import {
  Body,
  Controller,
  Post,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard.js';
import { IngestDto } from './ingest.dto.js';
import { IngestResult, IngestService } from './ingest.service.js';

// The global pipe strips unknown fields silently; this endpoint must reject them.
// Typing the body as `object` makes the global pipe skip it, so this pipe validates.
const ingestPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  expectedType: IngestDto,
  validationError: { target: false, value: false },
});

@Controller('ingest')
@UseGuards(ApiKeyGuard)
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post()
  async ingest(
    @Body(ingestPipe) body: object,
    @Res({ passthrough: true }) res: { status(code: number): unknown },
  ): Promise<IngestResult> {
    const result = await this.ingestService.ingest(body as IngestDto);
    res.status(result.status === 'created' ? 201 : 200);
    return result;
  }
}
