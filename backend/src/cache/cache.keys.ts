const prefix = (periodo: string) => `movilidad:v1:${periodo}`;

export const cacheKeys = {
  resumen: (periodo: string) => `${prefix(periodo)}:resumen`,
  diario: (periodo: string) => `${prefix(periodo)}:diario`,
  // Today is part of the key because the projection depends on it.
  proyeccion: (periodo: string, today: string) =>
    `${prefix(periodo)}:proyeccion:${today}`,
  registros: (periodo: string, page: number, limit: number) =>
    `${prefix(periodo)}:registros:${page}:${limit}`,
  /** Every key of a period, for invalidation. */
  periodoPattern: (periodo: string) => `${prefix(periodo)}:*`,
};
