import {
  RutasRoutingService,
  type RutaPendiente,
} from './rutas-routing.service.js';

const pendiente = (n: number): RutaPendiente => ({
  origenHash: `o${n}`,
  destinoHash: `d${n}`,
  origenTexto: `origen ${n}`,
  destinoTexto: `destino ${n}`,
});
const ruta = { distancia_m: 1000, duracion_s: 600, geocode_confianza: 0.8 };

describe('RutasRoutingService', () => {
  let provider: { enabled: boolean; ruta: ReturnType<typeof vi.fn> };
  let redis: {
    exists: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
  let repo: { guardar: ReturnType<typeof vi.fn> };
  let service: RutasRoutingService;

  beforeEach(() => {
    provider = { enabled: true, ruta: vi.fn().mockResolvedValue(ruta) };
    redis = {
      exists: vi.fn().mockResolvedValue(0),
      set: vi.fn().mockResolvedValue('OK'),
    };
    repo = { guardar: vi.fn().mockResolvedValue(undefined) };
    service = new RutasRoutingService(
      provider as never,
      0,
      redis as never,
      repo as never,
    );
  });

  afterEach(() => service.onApplicationShutdown());

  it('computes a missing route in the background and stores it', async () => {
    await service.enqueue([pendiente(1)]);
    await vi.waitFor(() => expect(repo.guardar).toHaveBeenCalledTimes(1));
    expect(provider.ruta).toHaveBeenCalledWith('origen 1', 'destino 1');
    expect(repo.guardar).toHaveBeenCalledWith('o1', 'd1', 1000, 600, 0.8);
  });

  it('reports idle once the queue is drained', async () => {
    await service.enqueue([pendiente(1), pendiente(2)]);
    await service.idle();
    expect(repo.guardar).toHaveBeenCalledTimes(2);
    await expect(service.idle()).resolves.toBeUndefined();
  });

  it('processes routes one at a time, in order', async () => {
    let running = 0;
    let overlap = false;
    provider.ruta.mockImplementation(async () => {
      running++;
      overlap ||= running > 1;
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return ruta;
    });
    await service.enqueue([pendiente(1), pendiente(2), pendiente(3)]);
    await vi.waitFor(() => expect(repo.guardar).toHaveBeenCalledTimes(3));
    expect(overlap).toBe(false);
    expect(repo.guardar.mock.calls.map((c) => c[0])).toEqual([
      'o1',
      'o2',
      'o3',
    ]);
  });

  it('does not queue the same route twice while it is pending', async () => {
    provider.ruta.mockImplementation(
      () => new Promise((r) => setTimeout(() => r(ruta), 10)),
    );
    await service.enqueue([pendiente(1)]);
    await service.enqueue([pendiente(1), pendiente(1)]);
    await vi.waitFor(() => expect(repo.guardar).toHaveBeenCalled());
    expect(provider.ruta).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a provider key', async () => {
    provider.enabled = false;
    await service.enqueue([pendiente(1)]);
    expect(provider.ruta).not.toHaveBeenCalled();
  });

  it('skips routes that failed recently', async () => {
    redis.exists.mockResolvedValue(1);
    await service.enqueue([pendiente(1)]);
    expect(provider.ruta).not.toHaveBeenCalled();
  });

  it('remembers a not-found route for a day and stores nothing', async () => {
    provider.ruta.mockResolvedValue(null);
    await service.enqueue([pendiente(1)]);
    await vi.waitFor(() => expect(redis.set).toHaveBeenCalled());
    expect(repo.guardar).not.toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith(
      'movilidad:ors:fail:o1:d1',
      '1',
      'EX',
      86400,
    );
  });

  it('remembers a provider error for an hour and carries on with the next route', async () => {
    provider.ruta.mockRejectedValueOnce(
      new Error('OpenRouteService answered 429'),
    );
    await service.enqueue([pendiente(1), pendiente(2)]);
    await vi.waitFor(() => expect(repo.guardar).toHaveBeenCalledTimes(1));
    expect(repo.guardar.mock.calls[0][0]).toBe('o2');
    expect(redis.set).toHaveBeenCalledWith(
      'movilidad:ors:fail:o1:d1',
      '1',
      'EX',
      3600,
    );
  });

  it('survives Redis being down', async () => {
    redis.exists.mockRejectedValue(new Error('down'));
    redis.set.mockRejectedValue(new Error('down'));
    provider.ruta.mockResolvedValueOnce(null).mockResolvedValueOnce(ruta);
    await service.enqueue([pendiente(1), pendiente(2)]);
    await vi.waitFor(() => expect(repo.guardar).toHaveBeenCalledTimes(1));
  });

  it('survives a storage error and lets the route be retried later', async () => {
    repo.guardar.mockRejectedValueOnce(new Error('db down'));
    await service.enqueue([pendiente(1), pendiente(2)]);
    await vi.waitFor(() => expect(repo.guardar).toHaveBeenCalledTimes(2));
  });

  it('stops taking work after shutdown', async () => {
    await service.onApplicationShutdown();
    await service.enqueue([pendiente(1)]);
    expect(provider.ruta).not.toHaveBeenCalled();
  });
});
