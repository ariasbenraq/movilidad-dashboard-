import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import {
  ROUTING_DELAY_MS,
  ROUTING_PROVIDER,
  type RoutingProvider,
} from './routing.provider.js';
import { RutasRepository } from './rutas.repository.js';

export interface RutaPendiente {
  origenHash: string;
  destinoHash: string;
  /** Free-text place sent to the provider (address plus district). Never logged. */
  origenTexto: string;
  destinoTexto: string;
}

const FAIL_TTL_ERROR_S = 60 * 60;
const FAIL_TTL_NOT_FOUND_S = 24 * 60 * 60;

/**
 * Computes missing routes in the background, one at a time, and stores them in
 * rutas_cache. In-process queue: it assumes a single backend instance and is
 * rebuilt by the next request after a restart. Failures are remembered briefly
 * in Redis so a bad address is not retried on every request.
 */
@Injectable()
export class RutasRoutingService implements OnApplicationShutdown {
  private readonly logger = new Logger(RutasRoutingService.name);
  private readonly queue: RutaPendiente[] = [];
  private readonly queued = new Set<string>();
  private draining: Promise<void> | null = null;
  private stopped = false;

  constructor(
    @Inject(ROUTING_PROVIDER) private readonly provider: RoutingProvider,
    @Inject(ROUTING_DELAY_MS) private readonly delayMs: number,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly repo: RutasRepository,
  ) {}

  get enabled(): boolean {
    return this.provider.enabled;
  }

  /** Queues the routes that are not cached, queued or recently failed. Returns at once. */
  async enqueue(pendientes: RutaPendiente[]): Promise<void> {
    if (!this.provider.enabled || this.stopped) return;
    for (const p of pendientes) {
      const key = `${p.origenHash}:${p.destinoHash}`;
      if (this.queued.has(key) || (await this.recentlyFailed(key))) continue;
      this.queued.add(key);
      this.queue.push(p);
    }
    if (this.queue.length > 0 && this.draining === null) {
      this.draining = this.drain()
        .catch((error: Error) =>
          this.logger.warn(`Route queue stopped: ${error.message}`),
        )
        .finally(() => {
          this.draining = null;
        });
    }
  }

  /** Resolves once the queue is empty and nothing is being computed. */
  async idle(): Promise<void> {
    while (this.draining !== null) await this.draining;
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    this.queue.length = 0;
    await this.draining;
  }

  private async drain(): Promise<void> {
    while (!this.stopped) {
      const next = this.queue.shift();
      if (!next) return;
      const key = `${next.origenHash}:${next.destinoHash}`;
      try {
        const ruta = await this.provider.ruta(
          next.origenTexto,
          next.destinoTexto,
        );
        if (ruta) {
          await this.repo.guardar(
            next.origenHash,
            next.destinoHash,
            ruta.distancia_m,
            ruta.duracion_s,
            ruta.geocode_confianza,
          );
        } else {
          await this.markFailed(key, FAIL_TTL_NOT_FOUND_S);
        }
      } catch (error) {
        // The message never holds addresses (see OrsError); nothing else is logged.
        this.logger.warn(
          `Route computation failed: ${(error as Error).message}`,
        );
        await this.markFailed(key, FAIL_TTL_ERROR_S);
      } finally {
        this.queued.delete(key);
      }
      if (this.delayMs > 0 && this.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      }
    }
  }

  private failKey(key: string): string {
    return `movilidad:ors:fail:${key}`;
  }

  private async recentlyFailed(key: string): Promise<boolean> {
    try {
      return (await this.redis.exists(this.failKey(key))) === 1;
    } catch {
      return false;
    }
  }

  private async markFailed(key: string, ttl: number): Promise<void> {
    try {
      await this.redis.set(this.failKey(key), '1', 'EX', ttl);
    } catch {
      // Redis is an optimization: worst case the route is retried sooner.
    }
  }
}
