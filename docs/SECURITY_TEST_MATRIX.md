# Security Test Matrix

This matrix maps required security behavior to current automated coverage and
known gaps. Keep it updated whenever protocol, token, admin, or session behavior
changes.

## Protocol Guardrails

| Requirement                                                     | Status             | Coverage                                                                  |
| --------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| Discovery advertises only `response_types_supported: ["code"]`. | Covered            | `src/oidc/oidc.controller.spec.ts`                                        |
| Discovery advertises only supported grant types.                | Covered            | `src/oidc/oidc.controller.spec.ts`                                        |
| Dynamic client registration is absent or blocked.               | Covered            | Better Auth guardrail tests and no Internal ID route.                     |
| Password grant fails.                                           | Covered            | `src/oidc/oidc-token.service.spec.ts` unsupported grants.                 |
| Client credentials grant fails.                                 | Covered            | `src/oidc/oidc-token.service.spec.ts` unsupported grants.                 |
| Device flow fails.                                              | Covered by absence | No device endpoint or grant implementation exists.                        |
| Implicit flow fails.                                            | Covered            | `src/oidc/oidc-authorization.service.spec.ts` unsupported response types. |
| Hybrid flow fails.                                              | Covered            | `src/oidc/oidc-authorization.service.spec.ts` unsupported response types. |
| PKCE is required.                                               | Covered            | `src/oidc/oidc-authorization.service.spec.ts`                             |
| `plain` PKCE fails.                                             | Covered            | `src/oidc/oidc-authorization.service.spec.ts`                             |
| Redirect URI matching is exact.                                 | Covered            | `src/oidc/oidc-authorization.service.spec.ts`                             |
| Claim release can be constrained per client.                    | Covered            | `src/oidc/oidc-token.service.spec.ts`, Better Auth claim policy tests.    |

## Token And Session State

| Requirement                                                                 | Status  | Coverage                                                                          |
| --------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| Authorization codes are stored as hashes.                                   | Covered | `src/oidc/oidc-authorization.service.spec.ts`                                     |
| Authorization code exchange happens in a transaction.                       | Covered | `src/oidc/oidc-token.service.ts` transaction path.                                |
| Consumed authorization code reuse fails.                                    | Covered | `src/oidc/oidc-token.service.spec.ts`                                             |
| Authorization code concurrent consumption is row-lock protected.            | Covered | Token exchange locks the authorization code row with `pessimistic_write`.         |
| Refresh tokens are stored as hashes.                                        | Covered | `src/tokens/refresh-token.service.spec.ts`                                        |
| Refresh token rotation links parent and successor.                          | Covered | Unit and PostgreSQL integration coverage in `src/tokens/`.                        |
| Refresh token replay revokes the family.                                    | Covered | Unit and PostgreSQL integration coverage in `src/tokens/`.                        |
| Refresh token rotation is row-lock protected.                               | Covered | PostgreSQL integration coverage verifies concurrent rotation behavior.            |
| Client disable blocks authorization.                                        | Covered | `src/oidc/oidc-authorization.service.spec.ts`                                     |
| Client disable blocks token exchange and refresh.                           | Covered | `src/oidc/oidc-token.service.spec.ts`, `src/tokens/refresh-token.service.spec.ts` |
| Inactive users cannot login, authorize, or refresh.                         | Covered | Authentication, authorization, and refresh token tests.                           |
| User deactivation immediately revokes existing sessions and refresh tokens. | Covered | `src/admin/admin-user.service.spec.ts`                                            |

## Browser And Admin Security

| Requirement                                                 | Status  | Coverage                                                                       |
| ----------------------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| Login CSRF protection.                                      | Covered | `src/authentication/authentication.service.spec.ts`                            |
| Admin CSRF protection.                                      | Covered | `src/admin/admin-csrf.guard.spec.ts`                                           |
| Recent authentication for sensitive admin routes.           | Covered | `src/admin/admin-recent-auth.guard.spec.ts`                                    |
| Admin authorization requires active admin group membership. | Covered | `src/admin/admin-access.service.spec.ts`                                       |
| Confidential client secret rotation is guarded and audited. | Covered | `src/admin/admin-api.controller.spec.ts`, `src/admin/admin-client.service.spec.ts` |
| SSR output escapes user-controlled content.                 | Covered | Login page service tests (`src/authentication/login-page.service.spec.ts`).    |
| Admin JSON APIs preserve provider-local protection.         | Covered | `AdminApiController` reuses `AdminGuard` + recent-auth + CSRF guards; `src/admin/admin-api.controller.spec.ts`. |
| Admin API presenters exclude secret hashes and internal columns. | Covered | `src/admin/admin-presenters.spec.ts`                                       |
| Security headers are emitted.                               | Covered | `src/common/security-headers.middleware.spec.ts`                               |
| Request logs include request ID and service context.        | Covered | `src/common/structured-logger.middleware.spec.ts`                              |

## Admin SPA (web/admin)

Client-side coverage for the standalone React admin app. These complement, but do
not replace, the server-side guards; the backend remains the enforcement
boundary.

| Requirement                                                          | Status  | Coverage                                                              |
| -------------------------------------------------------------------- | ------- | -------------------------------------------------------------------- |
| Mutations attach the `x-csrf-token` header; GETs do not.             | Covered | `web/admin/src/app/api-client.test.ts`                               |
| Error envelope (string and array) maps to typed client errors.       | Covered | `web/admin/src/app/api-client.test.ts`                               |
| Recent-auth `403` triggers re-auth then retries the mutation.        | Covered | `web/admin/src/app/reauth.test.tsx`                                  |
| Unauthenticated load redirects to provider login.                    | Covered | `web/admin/src/app/app.test.tsx`                                     |
| Non-admin session is denied without rendering admin data.            | Covered | `web/admin/src/app/app.test.tsx`                                     |
| No session/CSRF/secret material is written to web storage.           | Covered | `web/admin/src/app/hardening.test.tsx`                              |
| Rotated client secret is revealed once and not recoverable after.    | Covered | `web/admin/src/features/clients/clients.test.tsx`                    |
| Self-lockout guards require typed confirmation (user + group views).  | Covered | `web/admin/src/features/users/users.test.tsx`, `groups/groups.test.tsx` |
| Redirect URI validation matches backend (absolute, no fragment).     | Covered | `web/admin/src/features/clients/clients.test.tsx`                    |
| Identity conflicts (email/username/slug/clientId) surface inline.     | Covered | Users, groups, and clients feature tests.                           |
| Unexpected render errors show a safe fallback, not a stack trace.    | Covered | `web/admin/src/components/error-boundary.test.tsx`                   |
| User-controlled content is escaped (React/Radix; no `dangerouslySetInnerHTML`). | Covered by review | No `dangerouslySetInnerHTML` in `web/admin`; verify in review. |
| Full browser login-to-manage e2e (Playwright).                       | Covered | `web/admin/e2e/admin.e2e.spec.ts`, run against a live backend + seeded DB. |

## Audit And Secrets

| Requirement                                     | Status                      | Coverage                                                                       |
| ----------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| Login failures are audited without enumeration. | Covered                     | Authentication service tests.                                                  |
| Authorization code issuance is audited.         | Covered                     | OIDC authorization tests.                                                      |
| Token issuance is audited.                      | Covered                     | OIDC token tests.                                                              |
| Refresh replay is critical audit event.         | Covered                     | Refresh token tests.                                                           |
| Admin mutations write audit events.             | Covered                     | Admin service tests.                                                           |
| Audit metadata excludes raw secrets and tokens. | Covered by tests and review | Continue checking during reviews; avoid raw code/token/client secret metadata. |

## Required Manual Checks

- Run `pnpm test:migrations` against a reachable PostgreSQL instance.
- Run the sample client flow locally with `pnpm sample-client:start`.
- Expand PostgreSQL-level concurrency stress tests before production if token
  paths show contention under load.
- Before building the standalone React admin app, add API security tests for
  auth, CSRF/session posture, validation, pagination, and audit.
- Review production alerting and key rotation runbooks before go-live.
