import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { envValidationSchema } from '../config/env.validation.js';

loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const { error, value } = envValidationSchema.validate(process.env, {
  abortEarly: false,
});

if (error) {
  throw new Error(`Invalid environment configuration:\n${error.message}`);
}

const env = value as Record<string, string>;

const entities = fileURLToPath(
  new URL('../**/*.entity.{ts,js}', import.meta.url),
);
const migrations = fileURLToPath(
  new URL('../migrations/*.{ts,js}', import.meta.url),
);

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  entities: [entities],
  migrations: [migrations],
  synchronize: false,
});
