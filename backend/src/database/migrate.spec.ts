import { applyMigrations, MigrationRunner } from './migrate.js';

function fakeRunner(overrides: Partial<MigrationRunner> = {}) {
  const calls: string[] = [];
  const runner: MigrationRunner = {
    initialize: () => {
      calls.push('initialize');
      return Promise.resolve();
    },
    runMigrations: () => {
      calls.push('runMigrations');
      return Promise.resolve([{ name: 'A1' }, { name: 'B2' }]);
    },
    destroy: () => {
      calls.push('destroy');
      return Promise.resolve();
    },
    ...overrides,
  };
  return { runner, calls };
}

describe('applyMigrations', () => {
  it('initializes, runs and closes, returning the applied names', async () => {
    const { runner, calls } = fakeRunner();

    await expect(applyMigrations(runner)).resolves.toEqual(['A1', 'B2']);
    expect(calls).toEqual(['initialize', 'runMigrations', 'destroy']);
  });

  it('closes the connection when a migration fails', async () => {
    const { runner, calls } = fakeRunner({
      runMigrations: () => Promise.reject(new Error('boom')),
    });

    await expect(applyMigrations(runner)).rejects.toThrow('boom');
    expect(calls).toContain('destroy');
  });

  it('does not run anything when the connection cannot be opened', async () => {
    const { runner, calls } = fakeRunner({
      initialize: () => Promise.reject(new Error('no db')),
    });

    await expect(applyMigrations(runner)).rejects.toThrow('no db');
    expect(calls).not.toContain('runMigrations');
  });
});
