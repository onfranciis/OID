# Internal ID

Internal ID is an internal OpenID Connect identity provider built with NestJS,
TypeORM, PostgreSQL, and Better Auth. It ships with a standalone React admin
console (in `web/admin/`) served same-origin at `/admin`.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Install dependencies with `pnpm install`.
4. Run internal migrations with `pnpm migration:run`.
5. Create Better Auth tables with `pnpm better-auth:schema`.
6. Seed the bootstrap admin/client with `pnpm seed:bootstrap`.
7. Start the app with `pnpm start:dev`.

The app listens on `http://localhost:3000` by default.

## Admin Console (React SPA)

The admin console lives in `web/admin/` (Vite + React + TypeScript, Tailwind,
Radix) and is a same-origin client that reuses the provider session cookie and
CSRF token. It has its own package and lockfile.

Frontend-only development (mocked API via MSW):

```bash
pnpm admin:install   # first run, installs web/admin dependencies
pnpm admin:dev       # http://localhost:5173/admin/ (MSW-mocked contract)
pnpm admin:test      # component/integration tests (Vitest + RTL)
pnpm admin:lint      # ESLint
pnpm admin:build     # type-check + production build to web/admin/dist
```

Integrated (served by NestJS against the live `/admin/api/*` API):

```bash
pnpm admin:build && pnpm build && pnpm start   # SPA + API at http://localhost:3000/admin
```

NestJS serves `web/admin/dist` at `/admin` (with `/admin/api/*` excluded so it
reaches the API, and client-side deep links falling back to `index.html`). To
run the SPA dev server against a running backend instead of MSW:

```bash
VITE_USE_REAL_API=1 pnpm admin:dev
```

End-to-end tests (Playwright, `web/admin/e2e/`) drive the full login-to-manage
flow against a seeded backend:

```bash
pnpm admin:e2e:install   # one-time Chromium download
pnpm seed:bootstrap      # with BOOTSTRAP_ADMIN_PASSWORD set
E2E_ADMIN_EMAIL=admin@company.com E2E_ADMIN_PASSWORD=<pw> pnpm admin:e2e
```

See `web/admin/e2e/README.md` for the full prerequisites.

## Useful Commands

- `pnpm build`: compile the NestJS app.
- `pnpm lint`: run ESLint.
- `pnpm test`: run unit tests.
- `pnpm test:migrations`: verify migration run and rollback on a disposable database.
- `pnpm start:prod:migrate`: run migrations before production startup.
- `pnpm cleanup:expired`: cleanup expired authorization codes, sessions, and refresh tokens.
- `pnpm better-auth:schema`: materialize or verify Better Auth-owned tables.
- `pnpm sample-client:start`: run the sample OIDC client on `http://localhost:4000`.
- `pnpm admin:*`: admin console tasks (see Admin Console above) — `admin:dev`, `admin:build`, `admin:test`, `admin:e2e`.

## Docker

Run PostgreSQL only:

```bash
docker compose up -d postgres
```

Run app and PostgreSQL:

```bash
docker compose up --build
```

The image builds the admin SPA and serves it at `/admin`, so no separate
frontend deployment is needed.

## Operations

Operational guidance lives in `docs/OPERATIONS.md`, including environment
reference, backups, cleanup jobs, metrics, alerts, key rotation, and incident
checklists.

Client integration guidance lives in `docs/CLIENT_INTEGRATION.md`, including the
sample app, required ID token checks, session boundary, and logout behavior.

Admin guidance lives in `docs/ADMIN_GUIDE.md`; the security coverage matrix
lives in `docs/SECURITY_TEST_MATRIX.md`.
