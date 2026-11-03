import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRutasCache1762200000000 implements MigrationInterface {
  name = 'CreateRutasCache1762200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Only SHA-256 hashes of the normalized addresses are stored, never the addresses.
    await queryRunner.query(`
      CREATE TABLE rutas_cache (
        origen_hash char(64) NOT NULL,
        destino_hash char(64) NOT NULL,
        distancia_m integer NOT NULL CHECK (distancia_m >= 0),
        duracion_s integer NOT NULL CHECK (duracion_s >= 0),
        geocode_confianza numeric(4,3) NOT NULL CHECK (geocode_confianza BETWEEN 0 AND 1),
        fetched_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (origen_hash, destino_hash)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE rutas_cache`);
  }
}
