import { OrsClient, OrsError } from './ors.client.js';

const KEY = 'secret-ors-key';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const feature = (lon: number, lat: number, confidence: number) => ({
  features: [
    { geometry: { coordinates: [lon, lat] }, properties: { confidence } },
  ],
});

describe('OrsClient', () => {
  const fetchFn = vi.fn();
  const client = new OrsClient(KEY, fetchFn as never, 'https://ors.test');

  beforeEach(() => fetchFn.mockReset());

  it('geocodes both places, routes between them and keeps the lowest confidence', async () => {
    fetchFn
      .mockResolvedValueOnce(json(feature(-77.0, -12.0, 0.9)))
      .mockResolvedValueOnce(json(feature(-77.1, -12.1, 0.7)))
      .mockResolvedValueOnce(
        json({
          routes: [{ summary: { distance: 18449.6, duration: 2400.4 } }],
        }),
      );

    const ruta = await client.ruta(
      'Av. Perú 123, Sjm, Peru',
      'Jr. Cusco 5, Jesús María, Peru',
    );
    expect(ruta).toEqual({
      distancia_m: 18450,
      duracion_s: 2400,
      geocode_confianza: 0.7,
    });

    const [geo1, geo2, route] = fetchFn.mock.calls;
    expect(geo1[0]).toContain('https://ors.test/geocode/search?');
    expect(new URL(geo1[0]).searchParams.get('text')).toBe(
      'Av. Perú 123, Sjm, Peru',
    );
    expect(new URL(geo1[0]).searchParams.get('boundary.country')).toBe('PE');
    expect(new URL(geo2[0]).searchParams.get('text')).toBe(
      'Jr. Cusco 5, Jesús María, Peru',
    );
    expect(route[0]).toBe('https://ors.test/v2/directions/driving-car');
    expect(route[1].method).toBe('POST');
    expect(JSON.parse(route[1].body)).toEqual({
      coordinates: [
        [-77.0, -12.0],
        [-77.1, -12.1],
      ],
    });
  });

  it('sends the key in a header, never in the URL', async () => {
    fetchFn
      .mockResolvedValueOnce(json(feature(-77, -12, 1)))
      .mockResolvedValueOnce(json(feature(-77, -12, 1)))
      .mockResolvedValueOnce(
        json({ routes: [{ summary: { distance: 1, duration: 1 } }] }),
      );
    await client.ruta('a', 'b');
    for (const [url, init] of fetchFn.mock.calls) {
      expect(url).not.toContain(KEY);
      expect((init.headers as Headers).get('Authorization')).toBe(KEY);
    }
  });

  it('answers null, without routing, when a place cannot be located', async () => {
    fetchFn.mockResolvedValueOnce(json({ features: [] }));
    await expect(client.ruta('nowhere', 'b')).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    fetchFn.mockReset();
    fetchFn
      .mockResolvedValueOnce(json(feature(-77, -12, 1)))
      .mockResolvedValueOnce(json({ features: [] }));
    await expect(client.ruta('a', 'nowhere')).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('answers null when there is no road route (404)', async () => {
    fetchFn
      .mockResolvedValueOnce(json(feature(-77, -12, 1)))
      .mockResolvedValueOnce(json(feature(-77, -12, 1)))
      .mockResolvedValueOnce(json({ error: 'no route' }, 404));
    await expect(client.ruta('a', 'b')).resolves.toBeNull();
  });

  it('throws an error without addresses or URLs on provider failures', async () => {
    const places = 'Calle Privada 99, Distrito Secreto';
    for (const status of [401, 429, 500]) {
      fetchFn.mockReset();
      fetchFn.mockResolvedValueOnce(json({ error: places }, status));
      const error = await client.ruta(places, places).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(OrsError);
      expect((error as Error).message).toBe(
        `OpenRouteService answered ${status}`,
      );
      expect((error as Error).message).not.toContain('Privada');
    }
  });

  it('wraps network errors and unexpected bodies', async () => {
    fetchFn.mockRejectedValueOnce(
      new Error(
        'connect ECONNREFUSED https://ors.test/geocode?text=Calle%20Privada',
      ),
    );
    const net = await client
      .ruta('Calle Privada', 'b')
      .catch((e: unknown) => e);
    expect(net).toBeInstanceOf(OrsError);
    expect((net as Error).message).toBe('OpenRouteService request failed');

    fetchFn.mockReset();
    fetchFn
      .mockResolvedValueOnce(json(feature(-77, -12, 1)))
      .mockResolvedValueOnce(json(feature(-77, -12, 1)))
      .mockResolvedValueOnce(json({ routes: [{ summary: {} }] }));
    await expect(client.ruta('a', 'b')).rejects.toBeInstanceOf(OrsError);
  });

  it('is enabled only with a non-blank key', () => {
    expect(client.enabled).toBe(true);
    expect(new OrsClient(undefined).enabled).toBe(false);
    expect(new OrsClient('  ').enabled).toBe(false);
  });
});
