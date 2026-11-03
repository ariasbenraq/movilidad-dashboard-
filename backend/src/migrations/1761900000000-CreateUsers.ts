import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1761900000000 implements MigrationInterface {
  name = 'CreateUsers1761900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id bigserial PRIMARY KEY,
        username text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE users`);
  }
}
