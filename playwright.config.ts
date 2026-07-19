import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  testMatch: ['**/*.e2e-spec.ts'],
  fullyParallel: false,
  retries: 0,
  use: {
    // Must match APP_BASE_URL (.env) — the app derives its OIDC issuer and
    // endpoint URLs from that value, and the discovery-document test compares
    // against it directly.
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
  },
});
