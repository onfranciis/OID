# Better Auth Ownership Decision

Last updated: 2026-06-23

This file records the current coexistence decision between Better Auth-managed
tables and Internal ID-owned tables during the spike phase.

## Current decision

Internal ID remains the source of truth for identity policy and OIDC contract
state. Better Auth is currently treated as a substrate behind a local boundary.

During the spike:

- Better Auth may own its own base auth/session/plugin tables.
- Internal ID continues to own lifecycle, groups, memberships, client policy,
  redirect policy, authorization-code wrappers, refresh-token wrappers, signing
  key metadata, and audit events.
- Better Auth routes are not the public contract. They stay mounted under
  `/api/auth` and must be wrapped or constrained before becoming externally
  supported behavior.

## Better Auth-managed schema discovered by inspection

`pnpm better-auth:inspect` reported these Better Auth-managed tables:

- `user`
- `session`
- `account`
- `verification`
- `jwks`
- `oauthClient`
- `oauthRefreshToken`
- `oauthAccessToken`
- `oauthConsent`

After replacing the deprecated `oidc-provider` plugin with
`@better-auth/oauth-provider`, inspection also reported:

- New tables to create: `oauthClient`, `oauthRefreshToken`.
- New fields to add to `oauthAccessToken`: `token`, `sessionId`,
  `referenceId`, `refreshId`, `expiresAt`.
- New field to add to `oauthConsent`: `referenceId`.
- Existing `oauthAccessToken.scopes` and `oauthConsent.scopes` columns are
  currently `text` in the local database, while the supported provider expects
  `string[]`.

## Internal ID-owned schema already committed

Internal ID currently owns and has migrations for:

- `users`
- `groups`
- `group_memberships`
- `oidc_clients`
- `oidc_redirect_uris`
- `oidc_post_logout_redirect_uris`
- `provider_sessions`
- `authorization_codes`
- `refresh_tokens`
- `signing_keys`
- `audit_events`

## Reconciliation direction

The current direction is coexistence, not replacement.

Reasons:

- Better Auth’s discovered table names and concepts do not align one-for-one
  with the Internal ID wrapper schema already committed in Phase 2.
- Internal ID needs policy-rich fields Better Auth does not currently prove it
  can own without losing contract control.
- The spike already proved Better Auth exposes a broader route surface than the
  roadmap allows, so Internal ID must keep its wrapper layer anyway.

## Practical implications

- Do not delete or collapse the Internal ID-owned tables yet.
- Do not expose Better Auth tables as public application models.
- Treat Better Auth `user/session/account/...` records as implementation
  substrate until deeper ownership mapping is proven.
- Any future consolidation must be driven by explicit migrations and a new
  ownership review, not by convenience.
