import { defineConfig, devices } from '@playwright/test';

// End-to-end tests for the admin SPA served same-origin by NestJS.
//
// Prerequisites (see e2e/README.md):
//   1. A running backend with a migrated + seeded database and the built SPA at
//      web/admin/dist, reachable at E2E_BASE_URL (default http://localhost:3000).
//   2. Browsers installed: `pnpm exec playwright install chromium`.
//   3. Bootstrap admin credentials in E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
//
// Run with: `pnpm exec playwright test` from web/admin.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*.e2e.spec.ts'],
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
