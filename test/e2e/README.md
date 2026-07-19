# Backend end-to-end tests

These Playwright tests drive the real HTTP surface of a **live server** —
routing, guards, CSRF, cookies, the full OIDC protocol — the way service-level
unit and integration tests (`pnpm test`, `pnpm test:integration`) can't. They
are not part of either of those suites because they need a running, migrated,
seeded backend.

- `health.e2e-spec.ts` — health check, discovery document, JWKS. Runs
  unconditionally; the only prerequisite is a reachable server.
- `oidc-protocol.e2e-spec.ts` — full login → admin client provisioning →
  PKCE authorize/token → userinfo → RP-initiated logout journey, as the
  bootstrap admin. Self-skips unless `E2E_ADMIN_PASSWORD` is set.

## Prerequisites

From the repo root, with Postgres reachable:

```bash
pnpm migration:run          # internal schema
pnpm better-auth:schema     # Better Auth tables
pnpm seed:bootstrap         # bootstrap admin + sample client
pnpm build && pnpm start    # serve the API at http://127.0.0.1:3000
```

The bootstrap admin needs a password. Set `BOOTSTRAP_ADMIN_PASSWORD` before
seeding, then export the same value for the tests.

## Running

```bash
E2E_ADMIN_EMAIL=admin@company.com \
E2E_ADMIN_PASSWORD=<the bootstrap password> \
  pnpm test:e2e
```

`oidc-protocol.e2e-spec.ts` provisions its own throwaway public OIDC client via
the admin API (rather than depending on `BOOTSTRAP_CLIENT_SECRET` being set)
and disables it again before finishing. `health.e2e-spec.ts` needs no
credentials and runs even when `E2E_ADMIN_PASSWORD` is unset.
