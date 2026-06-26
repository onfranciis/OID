# Admin Guide

The Internal ID admin surface is provider-local and protected by provider
sessions, admin group membership, recent authentication, and CSRF checks.

Admin management is moving toward a standalone React app later. The backend
admin contract should therefore be treated as `/admin/api/*` JSON endpoints
protected by the same provider-local rules. The current server-rendered admin
pages are a temporary management surface, not the long-term UI boundary.

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
