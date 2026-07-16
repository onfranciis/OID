# Internal ID Operations

This runbook covers local operations, deployment checks, backup/restore, cleanup,
metrics, alerting, key rotation, and incident response for Internal ID.

## Local Development

1. Copy `.env.example` to `.env` and replace secrets before using shared
   environments.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Install dependencies with `pnpm install`.
4. Run internal migrations with `pnpm migration:run`.
5. Materialize Better Auth tables with `pnpm better-auth:schema`.
6. Seed the first admin and sample client with `pnpm seed:bootstrap`.
7. Start the app with `pnpm start:dev`.

For a containerized app plus database, run `docker compose up --build`.

After Better Auth or OAuth Provider plugin upgrades, run the schema inspection
path and review the output before deploying. New provider tables, provider
field additions, or column shape changes such as OAuth `scopes` must be handled
as explicit migrations or documented adapter decisions.

## Deployment

Build the production image from the repository root:

```bash
docker build -t internal-id:latest .
```

Run migrations before serving traffic:

```bash
pnpm start:prod:migrate
```

In production, prefer a one-shot migration job followed by `node dist/main` for
the app process. Do not enable TypeORM `synchronize` in production.

## Environment Reference

Required variables:

- `DATABASE_URL`: PostgreSQL connection string.
- `APP_BASE_URL`: Public issuer origin. Must use `https://` in production.
- `BETTER_AUTH_SECRET`: Random secret with at least 32 characters.
- `BETTER_AUTH_BASE_PATH`: Better Auth mount path, normally `/api/auth`.
- `AUTHENTICATION_PROVIDER_SESSION_COOKIE_NAME`: Provider session cookie name.
- `AUTHENTICATION_PROVIDER_SESSION_IDLE_TTL_SECONDS`: Idle session lifetime.
- `AUTHENTICATION_PROVIDER_SESSION_ABSOLUTE_TTL_SECONDS`: Maximum session lifetime.
- `AUTHENTICATION_LOGIN_RATE_LIMIT_WINDOW_SECONDS`: Login rate-limit window.
- `AUTHENTICATION_LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS`: Login attempts per IP.
- `AUTHENTICATION_LOGIN_RATE_LIMIT_ACCOUNT_MAX_ATTEMPTS`: Login attempts per account.
- `AUTHENTICATION_TOKEN_RATE_LIMIT_WINDOW_SECONDS`: Token endpoint rate-limit window.
- `AUTHENTICATION_TOKEN_RATE_LIMIT_IP_MAX_ATTEMPTS`: Token attempts per IP.

Bootstrap variables are only required when creating or updating the initial
admin/group/client records through `pnpm seed:bootstrap`.

Production validation rejects insecure defaults for `APP_BASE_URL`,
`BETTER_AUTH_SECRET`, and `BOOTSTRAP_ADMIN_PASSWORD`.

## Backup And Restore

Create a compressed PostgreSQL backup:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=internal-id.dump
```

Restore into an empty database:

```bash
pg_restore --dbname "$DATABASE_URL" --clean --if-exists internal-id.dump
```

After restore, verify:

- `pnpm migration:show` reports no pending internal migrations.
- `pnpm better-auth:schema` reports the Better Auth schema is up to date.
- Better Auth schema inspection does not report unreviewed OAuth Provider
  deltas.
- `/health` returns healthy status.
- An admin can log in and view the admin dashboard.

## Cleanup Jobs

Schedule expired state cleanup at least hourly:

```bash
pnpm cleanup:expired
```

The cleanup job removes expired or consumed authorization codes and revokes
expired provider sessions and refresh tokens. Keep the JSON output in job logs so
operators can trend deleted and revoked counts.

## Metrics

The app exposes Prometheus text metrics at `/metrics`.

Currently exported metrics:

- `internal_id_http_requests_total`: request count by method, normalized route,
  and status.
- `internal_id_http_request_duration_seconds_total`: cumulative request duration
  by method, normalized route, and status.

Watch these routes closely: `/admin/login`, `/oauth/token`, `/oauth/revoke`,
`/api/auth/*`, and `/oauth/authorize`.

## Alerts

Minimum production alerts:

- Failed login spike: sustained increase in `/admin/login` 4xx or 5xx responses.
- Token errors: sustained increase in `/oauth/token` 4xx or 5xx responses.
- Refresh replay: audit events with replay/family revocation reason.
- Key compromise: any emergency signing-key retirement or unplanned key change.
- Cleanup failure: scheduled `pnpm cleanup:expired` job exits non-zero.
- Migration drift: CI migration verification fails on `main`.

## Key Rotation

Normal rotation:

1. Add a new signing key row and mark it active.
2. Keep the previous key available in JWKS until all issued tokens expire.
3. Retire the old key after the maximum token lifetime has elapsed.
4. Verify `/oauth/jwks` exposes the active key and no prematurely removed keys.

Emergency rotation:

1. Disable the compromised key immediately.
2. Activate a new signing key.
3. Revoke affected provider sessions and refresh-token families if token misuse
   is plausible.
4. Notify client owners that cached JWKS entries must be refreshed.
5. Review audit events for suspicious authorization and token activity.

## Incident Checklist

Compromised secret:

- Rotate `BETTER_AUTH_SECRET` and any affected infrastructure secrets.
- Restart app instances with the new secret.
- Revoke active provider sessions if cookie integrity may be affected.

Compromised signing key:

- Follow emergency key rotation.
- Revoke refresh tokens issued during the exposure window.
- Preserve audit logs and database backup snapshots for investigation.

Compromised admin user:

- Disable the user immediately.
- Revoke provider sessions and refresh tokens for that user.
- Review audit events for changed users, clients, groups, and keys.

Compromised client:

- Disable the client immediately.
- Revoke refresh-token families for the client.
- Rotate the client secret if confidential-client support is enabled.
- Review redirect URI and consent/audit history before re-enabling.
