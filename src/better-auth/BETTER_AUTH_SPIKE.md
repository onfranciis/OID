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
- `src/better-auth/better-auth.guardrails.ts` blocks unsupported authorize,
  token, and dynamic registration requests before they reach Better Auth.
- `src/better-auth/BETTER_AUTH_OWNERSHIP.md` records the current coexistence
  decision for Better Auth-managed versus Internal ID-owned tables.
- `src/better-auth/BETTER_AUTH_COMPATIBILITY.md` records the current
  refresh-token and audit-hook compatibility findings from the installed Better
  Auth package.
- `src/better-auth/better-auth.controller.ts` now emits local audit events for
  accepted and rejected authorize/token requests plus blocked registration
  attempts through the Internal ID audit boundary.
- `src/better-auth/internal-audit.plugin.ts` now uses Better Auth
  `session.create.after` to emit `user.login.succeeded` through the local audit
  boundary.
- `src/tokens/refresh-token.service.ts` now owns local refresh-token wrapper
  issuance, rotation, replay-family revocation, and refresh audit emission.
- `src/better-auth/better-auth.controller.ts` now rewrites successful token
  responses so Internal ID wrapper refresh tokens are issued to clients and
  wrapper refresh grants are translated back to Better Auth upstream refresh
  tokens.
- `src/better-auth/claim-policy.ts` now applies Internal ID
  `allowed_claims` policy to additional OIDC claims per client.
- `pnpm better-auth:inspect` reports Better Auth plugin IDs, exposed API
  endpoint IDs, and Better Auth-managed schema tables.

## Spike answers

| ID | Question | Status | Finding |
| --- | --- | --- | --- |
| P3-01 | Can Better Auth run cleanly inside NestJS? | Done | Yes. The Better Auth runtime can be created in a Nest provider and mounted through a dedicated controller. |
| P3-02 | Can Better Auth use PostgreSQL with the chosen adapter? | Done | Yes. Better Auth full mode accepts a Kysely PostgreSQL dialect. It also expects its own schema footprint, which must be reconciled with Internal ID ownership rules. |
| P3-03 | Can OAuth Provider expose OIDC discovery? | Done | Yes. The OIDC plugin exposes discovery metadata and allows metadata overrides. |
| P3-04 | Can unsupported response types be rejected? | In Progress | Wrapper validation now rejects unsupported authorize shapes before they reach Better Auth, but broader end-to-end negative tests are still needed. |
| P3-05 | Can unsupported grant types be rejected? | In Progress | Wrapper validation now rejects unsupported token grants and blocks dynamic registration, but broader end-to-end negative tests are still needed. |
| P3-06 | Can PKCE be required for all clients? | Done | Yes, with caveat. `requirePKCE` can be set true, but `plain` must also be disabled explicitly. |
| P3-07 | Can dynamic registration be disabled? | Done | Yes, configuration can disable it, but the registration surface should still be blocked at the Internal ID boundary. |
| P3-08 | Can refresh token rotation behavior satisfy this guide? | In Progress | Internal ID now has local family/replay wrapper behavior and controller integration, but full route-level proof is still pending. |
| P3-09 | Can claims be shaped by client policy? | In Progress | Internal ID now constrains additional client claims per policy, but Better Auth base `email` and `profile` userinfo claims are still not fully suppressible at this layer. |
| P3-10 | Can audit hooks capture security events? | In Progress | Local audit capture now exists for Better Auth session creation plus authorize, token, and blocked registration traffic, but refresh and revocation coverage is still unproven. |

## Risks that remain

- The published `oidc-provider` plugin is deprecated in favor of a newer OAuth
  provider path, so upgrades may force a migration.
- The Better Auth OIDC route layout is mounted under `/api/auth/...`, not the
  final public `/oauth/...` contract required by Internal ID.
- Better Auth-managed schema tables are separate from the Internal ID-owned
  entities already committed in Phase 2.
- Better Auth refresh-token rotation is visible in package source, but family
  tracking and replay handling still appear weaker than the roadmap requires.
- The library surface is too permissive by default for Internal ID. Discovery,
  authorize, token, registration, and refresh behavior still need wrapper tests.
- Full HTTP route tests could not be kept in the current sandbox because the
  available test path still triggers a socket listen attempt. Controller-level
  boundary tests are in place, but full route execution should be re-run in a
  less restricted environment.

## Immediate next work

1. Run `pnpm better-auth:inspect` and capture the Better Auth-owned schema
   tables that would be introduced.
2. Add end-to-end protocol-negative tests around discovery, authorize, token,
   and registration behavior before adopting Better Auth endpoints as public
   contract routes.
3. Decide whether refresh replay detection and token-family semantics will be
   implemented as Internal ID wrappers or replaced with a different provider
   substrate before Phase 8 work begins.
