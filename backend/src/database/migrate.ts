/** Minimal slice of a TypeORM DataSource needed to apply migrations. */
export interface MigrationRunner {
  initialize(): Promise<unknown>;
  runMigrations(options?: { transaction?: 'all' | 'none' | 'each' }): Promise<
    { name: string }[]
  >;
  destroy(): Promise<void>;
}

/**
 * Applies pending migrations and always closes the connection.
 * Returns the names of the migrations that were applied.
 */
export async function applyMigrations(
  dataSource: MigrationRunner,
): Promise<string[]> {
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    return applied.map((migration) => migration.name);
  } finally {
    await dataSource.destroy();
  }
}
