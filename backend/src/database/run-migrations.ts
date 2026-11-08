// Production entry point: node dist/database/run-migrations.js
// Reads the DB_* variables from the environment (see data-source.ts) and logs
// only migration names, never connection details.
import { AppDataSource } from './data-source.js';
import { applyMigrations } from './migrate.js';

try {
  const applied = await applyMigrations(AppDataSource);
  console.log(
    applied.length
      ? `Applied migrations: ${applied.join(', ')}`
      : 'No pending migrations',
  );
} catch (error) {
  console.error(
    'Migration failed:',
    error instanceof Error ? error.message : 'unknown error',
  );
  process.exitCode = 1;
}
