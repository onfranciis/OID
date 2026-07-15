# Admin SPA end-to-end tests

These Playwright tests drive the full login-to-manage flow against a **live
backend** that serves the built SPA same-origin at `/admin`. They are not part
of the unit/integration suite (`pnpm admin:test`) because they need a running
Postgres, a seeded admin, and installed browsers.

## Prerequisites

From the repo root, with Postgres reachable:

```bash
pnpm migration:run          # internal schema
pnpm better-auth:schema     # Better Auth tables
pnpm seed:bootstrap         # bootstrap admin + client
pnpm --dir web/admin build  # produce web/admin/dist
pnpm build && pnpm start    # serve API + SPA at http://localhost:3000
```

The bootstrap admin needs a password. Set `BOOTSTRAP_ADMIN_PASSWORD` before
seeding, then export the same value for the tests.

## Running

From `web/admin`:

```bash
pnpm exec playwright install chromium   # one-time browser download
E2E_ADMIN_EMAIL=admin@company.com \
E2E_ADMIN_PASSWORD=<the bootstrap password> \
E2E_BASE_URL=http://localhost:3000 \
  pnpm exec playwright test
```

Tests `test.skip` themselves when `E2E_ADMIN_PASSWORD` is unset, so a bare
`playwright test` is a no-op rather than a failure.
