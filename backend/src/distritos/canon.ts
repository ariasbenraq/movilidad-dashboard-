import type { EntityManager } from 'typeorm';
import { normalizeDistrito } from '../ingest/ingest.rules.js';

/** Canonical district for a free-text one, or null when it is not mapped. */
export async function canonDistrito(
  db: Pick<EntityManager, 'query'>,
  texto: string | null,
): Promise<string | null> {
  if (texto === null) return null;
  const rows: { distrito: string }[] = await db.query(
    `SELECT distrito FROM distrito_equivalencias WHERE texto_normalizado = $1`,
    [normalizeDistrito(texto)],
  );
  return rows.length > 0 ? rows[0].distrito : null;
}
