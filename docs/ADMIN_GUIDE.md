# Admin Guide

The Internal ID admin surface is provider-local and protected by provider
sessions, admin group membership, recent authentication, and CSRF checks.

Admin management is a standalone React app served same-origin by NestJS at
`/admin`. The backend admin contract is the `/admin/api/*` JSON endpoints
(`AdminApiController`), protected by the same provider-local rules. The old
server-rendered admin pages have been retired in favor of the SPA.

## React Admin App

The standalone admin SPA lives in `web/admin/` (Vite + React + TypeScript,
Tailwind, Radix). It is a same-origin client that renders the Users, Groups,
Clients, and Audit sections plus an Overview landing page.

Security posture:

- It authenticates only through the existing `internal_id_provider_session`
  cookie; it never reads that cookie (HttpOnly) and never mints its own tokens.
- It bootstraps identity and a CSRF token from `GET /admin/api/session` and
  attaches the token as the `x-csrf-token` header on every mutation.
- Session, CSRF, and secret material are held in memory only. Nothing is written
  to `localStorage` or `sessionStorage`.
- A `401` sends the user to `/admin/login?returnTo=/admin`; a non-admin session shows
  an access-denied screen; the recent-auth `403` opens a re-authentication
  dialog and retries the original mutation.
- Rotated client secrets are shown exactly once and are never cached.
- Self-lockout guards require typed confirmation before an admin removes their
  own membership in the bootstrap admin group or renames that group's slug.

Serving: NestJS serves the Vite build (`web/admin/dist`) at `/admin` via
`ServeStaticModule`, with `/admin/api/*` excluded so it reaches
`AdminApiController` (see `src/admin/admin-static.options.ts`). Client-side deep
links fall back to `index.html`. The Docker image builds and includes the SPA.

Local development:

```bash
pnpm admin:install   # first run
pnpm admin:dev       # http://localhost:5173/admin/ (MSW-mocked)
pnpm admin:test      # component/integration tests
pnpm admin:build     # type-check + production build

# Integrated (real API), from the repo root, with a seeded database:
pnpm admin:build && pnpm build && pnpm start   # SPA + API at :3000/admin

# Or run the SPA dev server against a running backend (no MSW):
VITE_USE_REAL_API=1 pnpm admin:dev
```

End-to-end tests (Playwright) live in `web/admin/e2e/`; see that folder's
`README.md` for the seeded-backend + browser prerequisites (`pnpm admin:e2e`).

## Access Model

An admin request must satisfy all of these checks:

- A valid provider session cookie exists.
- The provider session has not expired or been revoked.
- The user is active.
- The user belongs to the bootstrap admin group.
- Sensitive mutation routes pass the recent-auth guard.
- Mutation routes include a valid admin CSRF token.
- Request bodies are validated before service code runs.
- List endpoints use bounded pagination.
- Mutations write audit events.

The detailed authorization rule is documented in
`src/admin/ADMIN_AUTHORIZATION.md`.

## Users

Admins can:

- Create users with email, display name, username, profile type, and optional
  given/family names.
- Update profile fields and identifiers.
- Set lifecycle status to pending, active, suspended, or deactivated.

Lifecycle effects:

- Pending, suspended, and deactivated users cannot log in.
- Existing provider sessions and refresh tokens are checked against active user
  status during authorization and refresh.
- Deactivation immediately revokes active provider sessions and refresh tokens
  with the `user_deactivated` reason.

## Groups

Admins can:

- Create groups.
- Update group display metadata.
- Add users to groups.
- Remove users from groups.

The bootstrap admin group controls access to `/admin`.

## Clients

Admins can:

- Create OIDC clients.
- Update allowed scopes, allowed claims, owner team, TTLs, and refresh-token
  policy.
- Disable or reactivate clients.
- Rotate confidential-client secrets. The raw secret is returned once and only
  the hash is stored.
- Add and remove exact redirect URIs.

Important constraints:

- Redirect URIs are exact matches only.
- Dynamic public client registration is not exposed.
- Confidential-client secrets can be seeded through `BOOTSTRAP_CLIENT_SECRET`
  or rotated through the guarded admin route.

## Audit

Admin mutations write audit events with actor, target, provider session,
request origin, user agent, and safe metadata. Audit metadata must never include
passwords, raw tokens, client secrets, private keys, CSRF tokens, or cookie
values.

Admins can query recent audit events through `/admin/audit-events`.

Future React admin views should consume admin JSON endpoints rather than adding
direct database access or bypassing the existing guards.

## Operational Actions

For local bootstrap:

```bash
pnpm migration:run
pnpm better-auth:schema
pnpm seed:bootstrap
```

For scheduled cleanup:

```bash
pnpm cleanup:expired
```

For incident response, backup/restore, and key rotation, use
`docs/OPERATIONS.md`.
