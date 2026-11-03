import { normalizeDistrito } from '../ingest/ingest.rules.js';

export interface UsoDistrito {
  id: string;
  texto: string;
}

export interface SinMapear {
  texto: string;
  registros: number;
}

/**
 * Unmapped district texts, one entry per normalized text, with the number of
 * records that use it (a record counts once even if origin and destination
 * share the text). Shown with its most frequent spelling; most used first.
 */
export function agruparSinMapear(usos: UsoDistrito[]): SinMapear[] {
  const groups = new Map<
    string,
    { ids: Set<string>; spellings: Map<string, number> }
  >();
  for (const { id, texto } of usos) {
    const key = normalizeDistrito(texto);
    if (key === '') continue;
    const group = groups.get(key) ?? { ids: new Set(), spellings: new Map() };
    group.ids.add(id);
    group.spellings.set(texto, (group.spellings.get(texto) ?? 0) + 1);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({
      texto: [...g.spellings.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0][0],
      registros: g.ids.size,
    }))
    .sort(
      (a, b) => b.registros - a.registros || a.texto.localeCompare(b.texto),
    );
}

/** The raw spellings stored in records that normalize to `key`. */
export function textosQueNormalizanA(key: string, raws: string[]): string[] {
  return [...new Set(raws)].filter((raw) => normalizeDistrito(raw) === key);
}

/** Months left in the year after the requested period: 12 - month. */
export function mesesRestantes(periodo: string): number {
  return 12 - Number(periodo.slice(5, 7));
}

export function visitasAnioEstimadas(
  visitasAnioHastaHoy: number,
  visitas: number,
  meses: number,
): number {
  return visitasAnioHastaHoy + visitas * meses;
}
