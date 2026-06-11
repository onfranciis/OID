# Better Auth Compatibility Notes

Last updated: 2026-06-11

This file records the current compatibility findings for the open Better Auth
spike questions around refresh-token behavior and audit-event capture.

## Refresh-token behavior

Current conclusion: partial match only. Better Auth rotates refresh tokens, but
the published `oidc-provider` implementation does not yet prove the Internal ID
requirements around token family tracking, replay detection, or Internal
ID-owned audit semantics.

Evidence captured from the installed package:

- `node_modules/better-auth/dist/plugins/oidc-provider/index.mjs` creates a new
  `oauthAccessToken` row and returns a new refresh token when
  `grant_type=refresh_token`.
- The same implementation looks up the presented refresh token by exact value
  from `oauthAccessToken.refreshToken`.
- `node_modules/better-auth/dist/plugins/oidc-provider/schema.d.mts` shows the
  Better Auth token table has:
  `accessToken`, `refreshToken`, `accessTokenExpiresAt`,
  `refreshTokenExpiresAt`, `clientId`, `userId`, `scopes`, and timestamps.
- The discovered Better Auth token schema does not expose Internal ID roadmap
  fields such as `family_id`, `parent_token_id`, `rotated_to_token_id`, or a
  revocation / replay marker.

What this means for Internal ID:

- Refresh-token rotation exists, so the base capability is not missing.
- Replay detection is not proven from the published schema or spike tests.
- Family-wide revocation semantics are not proven from the published schema or
  spike tests.
- Internal ID should keep its `refresh_tokens` wrapper table until replay,
  family tracking, and audit requirements are either implemented locally or
  explicitly proven against Better Auth behavior.
- Internal ID now has a local `RefreshTokenService` that owns wrapper issuance,
  rotation, replay-family revocation, and refresh audit event emission. It is
  now wired into the public token controller path for wrapped refresh-token
  issuance and refresh exchange.

## Audit-event capture

Current conclusion: partial match only. Better Auth exposes hook surfaces, but
this spike has not proven complete coverage for the Internal ID audit contract.

Evidence captured from the installed package:

- `node_modules/better-auth/dist/plugins/admin/admin.d.mts` exposes
  `databaseHooks` for `user.create.before` and `session.create.before`.
- `node_modules/better-auth/dist/plugins/oidc-provider/index.d.mts` exposes
  plugin `hooks.after`, which can observe endpoint traffic after Better Auth
  route execution.
- Internal ID now uses Better Auth `session.create.after` to emit
  `user.login.succeeded` through the local `AuditService` write boundary.
- The installed package surface does not yet prove a complete, typed audit hook
  path for all required Internal ID events:
  login, token issuance, refresh rotation, refresh replay, client mutations,
  and revocation paths.

What this means for Internal ID:

- Better Auth hooks are enough to justify a local audit abstraction.
- Audit writes should remain Internal ID-owned and should not be coupled
  directly to Better Auth table internals.
- The Nest `AuditService` should become the only write boundary for future
  Better Auth hook integration, controller-level security events, and admin
  mutations.
- Internal ID now records local boundary events for accepted and rejected
  authorize/token requests plus blocked registration attempts before deeper
  Better Auth hook coverage is added.
- Internal ID now records successful Better Auth session creation as
  `user.login.succeeded`, which gives the spike one real post-auth audit signal.

## Current direction

- Keep Better Auth behind `src/better-auth`.
- Keep refresh-token lifecycle policy behind Internal ID wrappers.
- Keep audit persistence behind the local audit module.
- Treat Better Auth as a protocol and session substrate, not as the source of
  truth for security event history.

## Claim policy shaping

Current conclusion: partial match only. Internal ID can constrain additional
OIDC claims by client policy, but Better Auth still keeps its own base
`email` and `profile` userinfo claims when those scopes are requested.

Evidence captured in repo:

- `src/better-auth/claim-policy.ts` now loads Internal ID client policy from
  `oidc_clients.allowed_claims` and applies it to additional claims.
- The current implementation constrains Internal ID-managed claims:
  `preferred_username`, `profile_type`, and `groups`.
- `node_modules/better-auth/dist/plugins/oidc-provider/index.mjs` shows the
  `userinfo` endpoint merges `baseUserClaims` with any additional claims, which
  means base `email` / `profile` claims are not fully suppressible at this
  layer.

What this means for Internal ID:

- Client-aware claim shaping is now proven for the Internal ID-specific claims
  carried through `getAdditionalUserInfoClaim`.
- Full per-client suppression of Better Auth base profile/email claims is not
  yet proven and may require a deeper wrapper or custom endpoint ownership.
