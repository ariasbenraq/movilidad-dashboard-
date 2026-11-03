import type { RoutingProvider, RutaCalculada } from './routing.provider.js';

const DEFAULT_BASE_URL = 'https://api.openrouteservice.org';
const TIMEOUT_MS = 10_000;

/** Never carries a URL, an address or a response body: those are personal data. */
export class OrsError extends Error {}

interface Punto {
  lon: number;
  lat: number;
  confianza: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

/** OpenRouteService: geocoding (Pelias) plus driving directions. No live traffic. */
export class OrsClient implements RoutingProvider {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  get enabled(): boolean {
    return Boolean(this.apiKey?.trim());
  }

  async ruta(origen: string, destino: string): Promise<RutaCalculada | null> {
    const a = await this.geocode(origen);
    if (!a) return null;
    const b = await this.geocode(destino);
    if (!b) return null;
    const resumen = await this.directions(a, b);
    if (!resumen) return null;
    return {
      distancia_m: Math.round(resumen.distance),
      duracion_s: Math.round(resumen.duration),
      geocode_confianza: Math.min(a.confianza, b.confianza),
    };
  }

  private async geocode(texto: string): Promise<Punto | null> {
    const params = new URLSearchParams({
      text: texto,
      'boundary.country': 'PE',
      size: '1',
    });
    const res = await this.request(`/geocode/search?${params.toString()}`);
    if (!res.ok) throw new OrsError(`OpenRouteService answered ${res.status}`);

    const body: unknown = await res.json();
    const feature =
      isRecord(body) && Array.isArray(body.features) ? body.features[0] : null;
    if (!isRecord(feature) || !isRecord(feature.geometry)) return null;
    const coords = feature.geometry.coordinates;
    const confianza = isRecord(feature.properties)
      ? feature.properties.confidence
      : undefined;
    if (
      !Array.isArray(coords) ||
      typeof coords[0] !== 'number' ||
      typeof coords[1] !== 'number' ||
      typeof confianza !== 'number'
    ) {
      return null;
    }
    return { lon: coords[0], lat: coords[1], confianza };
  }

  private async directions(
    a: Punto,
    b: Punto,
  ): Promise<{ distance: number; duration: number } | null> {
    const res = await this.request('/v2/directions/driving-car', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        coordinates: [
          [a.lon, a.lat],
          [b.lon, b.lat],
        ],
      }),
    });
    // 404: no routable point near one of the coordinates.
    if (res.status === 404) return null;
    if (!res.ok) throw new OrsError(`OpenRouteService answered ${res.status}`);

    const body: unknown = await res.json();
    const route =
      isRecord(body) && Array.isArray(body.routes) ? body.routes[0] : null;
    const summary = isRecord(route) ? route.summary : null;
    if (
      !isRecord(summary) ||
      typeof summary.distance !== 'number' ||
      typeof summary.duration !== 'number'
    ) {
      throw new OrsError('OpenRouteService answered an unexpected body');
    }
    return { distance: summary.distance, duration: summary.duration };
  }

  /** The key travels in a header so it never ends up in a logged URL. */
  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', this.apiKey ?? '');
    headers.set('Accept', 'application/json');
    try {
      return await this.fetchFn(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new OrsError('OpenRouteService request failed');
    }
  }
}
