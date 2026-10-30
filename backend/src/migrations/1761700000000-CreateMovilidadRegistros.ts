import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMovilidadRegistros1761700000000
  implements MigrationInterface
{
  name = 'CreateMovilidadRegistros1761700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE movilidad_registros (
        id bigserial PRIMARY KEY,
        gmail_message_id text NOT NULL UNIQUE,
        received_at timestamptz NOT NULL,
        fecha_form date NOT NULL,
        periodo char(7) NOT NULL,
        costo_movilidad numeric(10,2) NOT NULL DEFAULT 0
          CHECK (costo_movilidad BETWEEN 0 AND 5000),
        otros_gastos numeric(10,2) NOT NULL DEFAULT 0
          CHECK (otros_gastos BETWEEN 0 AND 5000),
        otros_detalle text NULL CHECK (char_length(otros_detalle) <= 500),
        he_inicio time NULL,
        he_fin time NULL,
        he_minutos integer NOT NULL DEFAULT 0,
        workorder text NULL,
        cliente text NULL,
        tipo_traslado text NULL,
        review_reason text NULL,
        needs_review boolean GENERATED ALWAYS AS (review_reason IS NOT NULL) STORED,
        parser_version text NOT NULL CHECK (char_length(parser_version) <= 20),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_movilidad_registros_periodo ON movilidad_registros (periodo)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_movilidad_registros_fecha_form ON movilidad_registros (fecha_form)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_movilidad_registros_fecha_workorder ON movilidad_registros (fecha_form, workorder)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE movilidad_registros`);
  }
}
