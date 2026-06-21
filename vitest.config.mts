import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'sample-client/**/*.spec.ts'],
    globals: true,
  },
});
