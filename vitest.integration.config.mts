import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration-spec.ts'],
    globals: true,
    setupFiles: ['test/load-env.ts'],
    // Every integration spec runs its own migrations against the same live
    // database (DATABASE_URL) in beforeAll. Vitest parallelizes across files
    // by default, which races those migration runs against each other —
    // serialize files so only one applies migrations at a time.
    fileParallelism: false,
  },
});
