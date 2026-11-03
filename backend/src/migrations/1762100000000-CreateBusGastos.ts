import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBusGastos1762100000000 implements MigrationInterface {
  name = 'CreateBusGastos1762100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Typed by hand to compare against taxi; never mixed into taxi totals.
    await queryRunner.query(`
      CREATE TABLE bus_gastos (
        id bigserial PRIMARY KEY,
        fecha date NOT NULL,
        distrito_origen text NOT NULL CHECK (char_length(distrito_origen) BETWEEN 1 AND 100),
        distrito_destino text NOT NULL CHECK (char_length(distrito_destino) BETWEEN 1 AND 100),
        distrito_origen_canon text NULL,
        distrito_destino_canon text NULL,
        costo numeric(10,2) NOT NULL CHECK (costo BETWEEN 0 AND 500),
        duracion_min integer NULL CHECK (duracion_min BETWEEN 1 AND 600),
        nota text NULL CHECK (char_length(nota) <= 200),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_bus_gastos_fecha ON bus_gastos (fecha)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE bus_gastos`);
  }
}
