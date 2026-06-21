# Internal ID

Internal ID is an internal OpenID Connect identity provider built with NestJS,
TypeORM, PostgreSQL, and Better Auth.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Install dependencies with `pnpm install`.
4. Run internal migrations with `pnpm migration:run`.
5. Create Better Auth tables with `pnpm better-auth:schema`.
6. Seed the bootstrap admin/client with `pnpm seed:bootstrap`.
7. Start the app with `pnpm start:dev`.

The app listens on `http://localhost:3000` by default.

## Useful Commands

- `pnpm build`: compile the NestJS app.
- `pnpm lint`: run ESLint.
- `pnpm test`: run unit tests.
- `pnpm test:migrations`: verify migration run and rollback on a disposable database.
- `pnpm start:prod:migrate`: run migrations before production startup.
- `pnpm cleanup:expired`: cleanup expired authorization codes, sessions, and refresh tokens.
- `pnpm better-auth:schema`: materialize or verify Better Auth-owned tables.

## Docker

Run PostgreSQL only:

```bash
docker compose up -d postgres
```

Run app and PostgreSQL:

```bash
docker compose up --build
```

## Operations

Operational guidance lives in `docs/OPERATIONS.md`, including environment
reference, backups, cleanup jobs, metrics, alerts, key rotation, and incident
checklists.
