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
- `src/better-auth/userinfo-policy.service.ts` now filters the final public
  userinfo payload by client policy, which closes the claim-suppression gap for
  the mounted `/api/auth/oauth2/userinfo` route.
- `pnpm better-auth:inspect` reports Better Auth plugin IDs, exposed API
  endpoint IDs, and Better Auth-managed schema tables.

## Spike answers

| ID    | Question                                                | Status | Finding                                                                                                                                                              |
| ----- | ------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3-01 | Can Better Auth run cleanly inside NestJS?              | Done   | Yes. The Better Auth runtime can be created in a Nest provider and mounted through a dedicated controller.                                                           |
| P3-02 | Can Better Auth use PostgreSQL with the chosen adapter? | Done   | Yes. Better Auth full mode accepts a Kysely PostgreSQL dialect. It also expects its own schema footprint, which must be reconciled with Internal ID ownership rules. |
| P3-03 | Can OAuth Provider expose OIDC discovery?               | Done   | Yes. The OAuth provider plugin exposes OIDC discovery metadata and allows advertised metadata overrides.                                                             |
| P3-04 | Can unsupported response types be rejected?             | Done   | Wrapper validation and Internal ID `/oauth/authorize` tests reject unsupported authorize shapes before they reach Better Auth.                                       |
| P3-05 | Can unsupported grant types be rejected?                | Done   | Wrapper validation and Internal ID `/oauth/token` tests reject unsupported token grants and block dynamic registration.                                              |
| P3-06 | Can PKCE be required for all clients?                   | Done   | Yes. The OAuth provider plugin defaults to PKCE for authorization-code flows and does not support `plain` challenges.                                                |
| P3-07 | Can dynamic registration be disabled?                   | Done   | Yes, configuration can disable it, but the registration surface should still be blocked at the Internal ID boundary.                                                 |
| P3-08 | Can refresh token rotation behavior satisfy this guide? | Done   | Internal ID owns local family/replay wrapper behavior, row-lock protected rotation, controller integration, and audit coverage.                                      |
| P3-09 | Can claims be shaped by client policy?                  | Done   | Internal ID now constrains additional claims and filters the mounted public userinfo payload by client policy.                                                       |
| P3-10 | Can audit hooks capture security events?                | Done   | Local audit capture exists for Better Auth session creation plus authorize, token, refresh, revocation, blocked registration, and admin mutation traffic.            |

## Risks that remain

- The deprecated `oidc-provider` plugin has been replaced with
  `@better-auth/oauth-provider`, but Better Auth-managed schema changes still
  need to be reviewed during upgrades.
- The Better Auth OIDC route layout is mounted under `/api/auth/...`, not the
  final public `/oauth/...` contract required by Internal ID.
- Better Auth-managed schema tables are separate from the Internal ID-owned
  entities already committed in Phase 2.
- The library surface is too permissive by default for Internal ID, so local
  wrappers and guardrail tests must remain in place during upgrades.
- Full HTTP route tests could not be kept in the current sandbox because the
  available test path still triggers a socket listen attempt. Controller-level
  boundary tests are in place, but full route execution should be re-run in a
  less restricted environment.

## Immediate next work

1. Run `pnpm better-auth:inspect` and capture the Better Auth-owned schema
   tables that would be introduced.
2. Re-run the protocol-negative and mounted Better Auth boundary suites after
   Better Auth upgrades.
3. Keep Internal ID `/oauth/*` routes as the public protocol contract unless a
   deliberate migration replaces the local wrappers.
