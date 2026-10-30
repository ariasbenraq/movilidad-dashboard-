import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ParserV21761800000000 implements MigrationInterface {
  name = 'ParserV21761800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE movilidad_registros
        ADD COLUMN distrito_origen text NULL CHECK (char_length(distrito_origen) <= 100),
        ADD COLUMN distrito_destino text NULL CHECK (char_length(distrito_destino) <= 100),
        ADD COLUMN direccion_origen text NULL CHECK (char_length(direccion_origen) <= 200),
        ADD COLUMN direccion_destino text NULL CHECK (char_length(direccion_destino) <= 200),
        ADD COLUMN distrito_origen_canon text NULL,
        ADD COLUMN distrito_destino_canon text NULL,
        ADD COLUMN hora_inicio time NULL
    `);
    await queryRunner.query(
      `CREATE INDEX idx_movilidad_registros_distrito_destino_canon ON movilidad_registros (distrito_destino_canon)`,
    );
    await queryRunner.query(`
      CREATE TABLE distrito_equivalencias (
        texto_normalizado text PRIMARY KEY,
        distrito text NOT NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE distrito_equivalencias`);
    await queryRunner.query(
      `DROP INDEX idx_movilidad_registros_distrito_destino_canon`,
    );
    await queryRunner.query(`
      ALTER TABLE movilidad_registros
        DROP COLUMN hora_inicio,
        DROP COLUMN distrito_destino_canon,
        DROP COLUMN distrito_origen_canon,
        DROP COLUMN direccion_destino,
        DROP COLUMN direccion_origen,
        DROP COLUMN distrito_destino,
        DROP COLUMN distrito_origen
    `);
  }
}
