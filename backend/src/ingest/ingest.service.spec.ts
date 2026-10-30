import { IngestService } from './ingest.service.js';
import type { IngestDto } from './ingest.dto.js';

const dto = {
  gmail_message_id: 'abc',
  received_at: '2026-10-07T20:41:00-05:00',
  fecha_form: '2026-10-07',
  costo_movilidad: 10,
  parser_version: '1.0.0',
} as IngestDto;

describe('IngestService cache invalidation', () => {
  const dataSource = (result: unknown) => ({
    transaction: vi.fn().mockResolvedValue(result),
  });

  it('does not fail the ingest when Redis errors', async () => {
    const redis = { scan: vi.fn().mockRejectedValue(new Error('down')), del: vi.fn() };
    const service = new IngestService(
      dataSource({ status: 'created', id: 1 }) as never,
      redis as never,
    );
    await expect(service.ingest(dto)).resolves.toEqual({
      status: 'created',
      id: 1,
    });
  });

  it('does not touch the cache for a duplicate', async () => {
    const redis = { scan: vi.fn(), del: vi.fn() };
    const service = new IngestService(
      dataSource({ status: 'duplicate' }) as never,
      redis as never,
    );
    await service.ingest(dto);
    expect(redis.scan).not.toHaveBeenCalled();
  });
});
