export const ROUTING_PROVIDER = Symbol('ROUTING_PROVIDER');

/** Pause between routes so a burst of new routes stays under the provider's rate limits. */
export const ROUTING_DELAY_MS = Symbol('ROUTING_DELAY_MS');
export const DEFAULT_ROUTING_DELAY_MS = 2000;

export interface RutaCalculada {
  distancia_m: number;
  duracion_s: number;
  /** Lowest geocoding confidence of the two addresses, 0 to 1. */
  geocode_confianza: number;
}

export interface RoutingProvider {
  readonly enabled: boolean;
  /**
   * Driving distance and time between two free-text places, or null when one of
   * them cannot be located or no road route exists. Throws on provider errors.
   */
  ruta(origen: string, destino: string): Promise<RutaCalculada | null>;
}
