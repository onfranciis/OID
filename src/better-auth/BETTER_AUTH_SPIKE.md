# Better Auth Spike Findings

Last updated: 2026-06-11

This file records the current Better Auth spike findings for Internal ID.

## Current conclusion

Better Auth can be mounted cleanly inside NestJS and backed by PostgreSQL
through its Kysely-based full mode, but its default OIDC surface is broader
than the Internal ID MVP contract. Internal ID must keep Better Auth behind
local wrappers and route guards.

## Evidence captured in repo

- `src/better-auth/better-auth.factory.ts` creates the Better Auth runtime with
  PostgreSQL, JWT, and OIDC provider plugins.
- `src/better-auth/better-auth.controller.ts` mounts Better Auth under
  `/api/auth`.
- `pnpm better-auth:inspect` reports Better Auth plugin IDs, exposed API
  endpoint IDs, and Better Auth-managed schema tables.

## Spike answers

| ID | Question | Status | Finding |
| --- | --- | --- | --- |
| P3-01 | Can Better Auth run cleanly inside NestJS? | Done | Yes. The Better Auth runtime can be created in a Nest provider and mounted through a dedicated controller. |
| P3-02 | Can Better Auth use PostgreSQL with the chosen adapter? | Done | Yes. Better Auth full mode accepts a Kysely PostgreSQL dialect. It also expects its own schema footprint, which must be reconciled with Internal ID ownership rules. |
| P3-03 | Can OAuth Provider expose OIDC discovery? | Done | Yes. The OIDC plugin exposes discovery metadata and allows metadata overrides. |
| P3-04 | Can unsupported response types be rejected? | In Progress | Better Auth’s published OIDC types still admit `token`, so Internal ID should not trust plugin defaults alone. Wrapper validation remains required. |
| P3-05 | Can unsupported grant types be rejected? | In Progress | The dynamic registration payload types still admit broad grant types. Internal ID must block registration and validate token requests locally. |
| P3-06 | Can PKCE be required for all clients? | Done | Yes, with caveat. `requirePKCE` can be set true, but `plain` must also be disabled explicitly. |
| P3-07 | Can dynamic registration be disabled? | Done | Yes, configuration can disable it, but the registration surface should still be blocked at the Internal ID boundary. |
| P3-08 | Can refresh token rotation behavior satisfy this guide? | In Progress | Better Auth exposes expiry configuration, but this spike has not yet proven family tracking, replay detection, or auditable rotation semantics. |
| P3-09 | Can claims be shaped by client policy? | In Progress | Additional claims can be customized, but the per-client Internal ID claim policy still needs a wrapper layer tied to Internal ID-owned client records. |
| P3-10 | Can audit hooks capture security events? | In Progress | This spike has not yet proven a complete audit hook path for login, token, client, and revocation events. |

## Risks that remain

- The published `oidc-provider` plugin is deprecated in favor of a newer OAuth
  provider path, so upgrades may force a migration.
- The Better Auth OIDC route layout is mounted under `/api/auth/...`, not the
  final public `/oauth/...` contract required by Internal ID.
- Better Auth-managed schema tables are separate from the Internal ID-owned
  entities already committed in Phase 2.
- The library surface is too permissive by default for Internal ID. Discovery,
  authorize, token, registration, and refresh behavior still need wrapper tests.

## Immediate next work

1. Run `pnpm better-auth:inspect` and capture the Better Auth-owned schema
   tables that would be introduced.
2. Decide whether Better Auth-owned auth/session/client tables will coexist with
   or replace parts of the current Internal ID wrapper schema.
3. Add protocol-negative tests around discovery, authorize, token, and
   registration behavior before adopting Better Auth endpoints as public
   contract routes.
