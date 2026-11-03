import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConfigFeriados1762000000000 implements MigrationInterface {
  name = 'CreateConfigFeriados1762000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE config (
        key text PRIMARY KEY,
        value text NOT NULL
      )
    `);
    // tarifa_hora_extra is intentionally absent: overtime is reported in hours only.
    await queryRunner.query(`
      INSERT INTO config (key, value) VALUES
        ('timezone', 'America/Lima'),
        ('dias_laborables', '1,2,3,4,5,6'),
        ('pago_dia', '15'),
        ('pago_fin_de_semana', 'next'),
        ('factor_trafico', '1.3'),
        ('presupuesto_meses', '3')
    `);
    await queryRunner.query(`
      CREATE TABLE feriados (
        fecha date PRIMARY KEY,
        nombre text NOT NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE feriados`);
    await queryRunner.query(`DROP TABLE config`);
  }
}
