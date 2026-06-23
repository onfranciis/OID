# Better Auth Compatibility Notes

Last updated: 2026-06-23

This file records the current compatibility findings for the open Better Auth
spike questions around refresh-token behavior and audit-event capture.

## Refresh-token behavior

Current conclusion: partial match only. Better Auth rotates refresh tokens, and
the supported `@better-auth/oauth-provider` package now stores refresh tokens in
a dedicated `oauthRefreshToken` table. Internal ID still owns token family
tracking, replay detection, and Internal ID-owned audit semantics.

Evidence captured from the installed package:

- `node_modules/@better-auth/oauth-provider/dist/oauth-D74mBkw6.d.mts` shows
  separate `oauthAccessToken` and `oauthRefreshToken` schema models.
- The supported provider stores access-token values under `oauthAccessToken.token`
  and refresh-token values under `oauthRefreshToken.token`.
- Both token models include `clientId`, `userId`, `sessionId`, `expiresAt`,
  `createdAt`, and `scopes`; refresh tokens also include `revoked` and
  `authTime`.
- The discovered Better Auth token schema does not expose Internal ID roadmap
  fields such as `family_id`, `parent_token_id`, `rotated_to_token_id`, or a
  revocation / replay marker.

What this means for Internal ID:

- Refresh-token rotation exists, so the base capability is not missing.
- Replay detection is still Internal ID-owned.
- Family-wide revocation semantics are still Internal ID-owned.
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
- `@better-auth/oauth-provider` exposes the OAuth/OIDC endpoint surface, while
  Internal ID records security-relevant events at the Nest controller boundary.
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

Current conclusion: workable with wrapper ownership. Internal ID now constrains
additional claims by client policy and also filters the mounted public
`userinfo` response before it leaves the Nest boundary.

Evidence captured in repo:

- `src/better-auth/claim-policy.ts` now loads Internal ID client policy from
  `oidc_clients.allowed_claims` and applies it to additional claims.
- `src/better-auth/userinfo-policy.service.ts` now filters the final mounted
  `userinfo` payload using the current access token's client and scope context.
- The current implementation constrains Internal ID-managed claims:
  `preferred_username`, `profile_type`, and `groups`.
- `@better-auth/oauth-provider` exposes `customUserInfoClaims`, and Internal ID
  also filters the final public `userinfo` response itself.

What this means for Internal ID:

- Client-aware claim shaping is now proven for both additional claims and the
  mounted public `userinfo` payload exposed by Internal ID.
- Strict claim governance still depends on keeping the public `userinfo` route
  behind the Internal ID wrapper rather than exposing Better Auth directly.
