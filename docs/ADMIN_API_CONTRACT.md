# Admin API Contract (`/admin/api/*`)

This document is the target contract for the admin JSON API that the React admin
app ([FRONTEND_ROADMAP.md](../FRONTEND_ROADMAP.md)) consumes. It corresponds to
backend queue item **B-07** in [ROADMAP.md](../ROADMAP.md).

The `/admin/api/*` layer is implemented by `AdminApiController`
(`src/admin/admin-api.controller.ts`), backed by the read methods on the admin
services and the presenters in `src/admin/admin-presenters.ts`. The frontend's
MSW handlers (`web/admin/src/mocks/handlers.ts`) mirror the same shapes for
offline development. Statuses below are **Implemented** unless noted.

## Conventions

- Base path: all routes under `/admin/api/*`, same origin as the provider.
- Auth: the existing `internal_id_provider_session` cookie (HttpOnly). Enforced by
  `AdminGuard` / `AdminAccessService`. Missing or invalid session → `401`;
  authenticated non-admin → `403`.
- CSRF: mutations require the `x-csrf-token` header matching the `Path=/admin`
  double-submit cookie (`AdminCsrfService`).
- Recent-auth: mutations require session `authTime` within 600s
  (`AdminRecentAuthGuard`); otherwise `403` with a message containing
  "Recent admin authentication required." (the SPA keys the re-auth flow off it).
- Content type: JSON in and out.
- Errors: NestJS envelope `{ statusCode: number, message: string | string[], error: string }`.
- IDs: prefixed ULIDs (`usr_`, `grp_`, `cli_`, `rdu_`, `aud_`). Timestamps are
  ISO-8601 strings.
- Secrets: `clientSecretHash` is never returned. A plaintext client secret is
  returned exactly once, only from the rotate-secret response.

## Session

### `GET /admin/api/session` — Implemented

Bootstraps the SPA: returns the current admin identity, a fresh CSRF token, and
the admin group slug, and sets the CSRF cookie. Replaces the SSR practice of
injecting the token into HTML.

```json
{
  "user": { "id": "usr_...", "displayName": "Internal ID Administrator", "email": "admin@company.com" },
  "isAdmin": true,
  "csrfToken": "<nonce>.<signature>",
  "adminGroupSlug": "internal-id-admins"
}
```

`adminGroupSlug` echoes `BOOTSTRAP_ADMIN_GROUP_SLUG`. The SPA uses it for
self-lockout guards (e.g. requiring typed confirmation before an admin removes
their own membership in that group) and cannot read backend config otherwise.

## Users

`UserSummary` and `UserDetail` derive from `UserEntity` (secrets/security columns
excluded).

```ts
type UserStatus = 'pending' | 'active' | 'suspended' | 'deactivated';
type UserProfileType = 'employee' | 'contractor' | 'service';

interface UserSummary {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  profileType: UserProfileType;
  status: UserStatus;
  createdAt: string;
}

interface UserDetail extends UserSummary {
  givenName: string | null;
  familyName: string | null;
  emailVerifiedAt: string | null;
  updatedAt: string;
  deactivatedAt: string | null;
  groups: Array<{ id: string; slug: string; displayName: string }>;
}

interface SetUserStatusResponse {
  user: UserDetail;
  // Present only when deactivation revoked live security state.
  revokedProviderSessionCount?: number;
  revokedRefreshTokenCount?: number;
}
```

| Method + Path                                        | Status   | Notes                                                        |
| ---------------------------------------------------- | -------- | ------------------------------------------------------------ |
| `GET /admin/api/users?cursor=&limit=&status=&q=`     | Proposed | Paginated. `q` matches email/username/displayName. Returns `{ items: UserSummary[], nextCursor: string \| null }`. |
| `GET /admin/api/users/:id`                           | Proposed | Returns `UserDetail`. `404` if absent.                      |
| `POST /admin/api/users`                              | Exists\* | Body = `AdminCreateUserInput`. Returns `UserDetail`.        |
| `POST /admin/api/users/:id`                          | Exists\* | Body = `AdminUpdateUserInput` (partial). Returns `UserDetail`. |
| `POST /admin/api/users/:id/status`                   | Exists\* | Body `{ status: UserStatus }`. Returns `SetUserStatusResponse`. Deactivation revokes sessions + refresh tokens. |

All of the above are implemented by `AdminApiController` under `/admin/api/*`
(the legacy SSR routes under `/admin/*` remain until F6 retires them). Create,
update, and status endpoints return the full `UserDetail` shape (with `groups`);
`.../status` returns `{ user: UserDetail }`.

Request bodies (from `AdminUserService`):

```ts
interface AdminCreateUserInput {
  email: string;
  displayName: string;
  givenName?: string | null;
  familyName?: string | null;
  username?: string | null;
  profileType?: UserProfileType;
}
type AdminUpdateUserInput = Partial<AdminCreateUserInput>;
```

Validation mirrors the service: `email` and `displayName` required and trimmed;
email/username uniqueness violations → `409 Conflict` with a message naming the
field (`"Email is already in use."` / `"Username is already in use."`) so the UI
can attach it to the right input.

## Groups

```ts
interface GroupSummary {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
}

interface GroupDetail extends GroupSummary {
  updatedAt: string;
  members: Array<{ id: string; displayName: string; email: string; status: UserStatus }>;
}
```

| Method + Path                                      | Status   | Notes                                                    |
| -------------------------------------------------- | -------- | -------------------------------------------------------- |
| `GET /admin/api/groups?cursor=&limit=&q=`          | Proposed | `{ items: GroupSummary[], nextCursor }`. Backs the F2 group picker and the F4 Groups section. |
| `GET /admin/api/groups/:id`                        | Proposed | `GroupDetail` with members.                              |
| `POST /admin/api/groups`                           | Exists\* | Body = `{ slug, displayName, description? }`.            |
| `POST /admin/api/groups/:id`                       | Exists\* | Partial update. Slug uniqueness → `409`.                |
| `POST /admin/api/groups/:id/members/:userId`       | Exists\* | Add membership (idempotent).                            |
| `POST /admin/api/groups/:id/members/:userId/remove`| Exists\* | Remove membership. `404` if not a member.               |

## Clients

`clientSecretHash` is never serialized.

```ts
type OidcClientType = 'confidential' | 'public';
type OidcClientStatus = 'active' | 'disabled';

interface ClientSummary {
  id: string;
  clientId: string;
  name: string;
  type: OidcClientType;
  status: OidcClientStatus;
  ownerTeam: string | null;
  hasSecret: boolean;      // derived: clientSecretHash != null
  createdAt: string;
}

interface ClientDetail extends ClientSummary {
  allowedScopes: string[];
  allowedClaims: string[];
  requirePkce: boolean;
  allowRefreshTokens: boolean;
  accessTokenTtlSeconds: number;
  idTokenTtlSeconds: number;
  refreshTokenIdleTtlSeconds: number | null;
  refreshTokenAbsoluteTtlSeconds: number | null;
  updatedAt: string;
  redirectUris: Array<{ id: string; uri: string }>;
}
```

| Method + Path                                                 | Status   | Notes                                                       |
| ------------------------------------------------------------- | -------- | ----------------------------------------------------------- |
| `GET /admin/api/clients?cursor=&limit=&status=&q=`            | Proposed | `{ items: ClientSummary[], nextCursor }`.                   |
| `GET /admin/api/clients/:id`                                  | Proposed | `ClientDetail` with redirect URIs.                          |
| `POST /admin/api/clients`                                     | Exists\* | Body = `AdminCreateClientInput`.                            |
| `POST /admin/api/clients/:id`                                 | Exists\* | Body = `AdminUpdateClientInput` (partial).                  |
| `POST /admin/api/clients/:id/status`                          | Exists\* | Body `{ status: OidcClientStatus }`.                        |
| `POST /admin/api/clients/:id/secret/rotate`                   | Exists\* | Confidential only. Returns `{ clientId, clientSecret }` **once**. |
| `POST /admin/api/clients/:id/redirect-uris`                   | Exists\* | Body `{ uri }`. Absolute http/https, no fragment; dupes → `409`. |
| `POST /admin/api/clients/:id/redirect-uris/:redirectUriId/remove` | Exists\* | Remove a redirect URI.                                 |

Request bodies (from `AdminClientService`):

```ts
interface AdminCreateClientInput {
  clientId: string;
  name: string;
  type?: OidcClientType;                 // default 'confidential'
  allowedScopes?: string[];              // default ['openid']
  allowedClaims?: string[];              // default ['sub']
  requirePkce?: boolean;                 // default true
  allowRefreshTokens?: boolean;          // default false
  accessTokenTtlSeconds?: number;        // default 900
  idTokenTtlSeconds?: number;            // default 900
  refreshTokenIdleTtlSeconds?: number | null;
  refreshTokenAbsoluteTtlSeconds?: number | null;
  ownerTeam?: string | null;
}
type AdminUpdateClientInput = Partial<Omit<AdminCreateClientInput, 'clientId' | 'type'>>;
```

## Audit

Derives from `AuditEventEntity`.

```ts
type AuditSeverity = 'info' | 'warning' | 'critical'; // matches audit-event.entity.ts

interface AuditEvent {
  id: string;
  eventType: string;
  severity: AuditSeverity;
  actorUserId: string | null;
  targetUserId: string | null;
  clientId: string | null;
  providerSessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

| Method + Path                                                                     | Status   | Notes                                                                                  |
| --------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `GET /admin/api/audit-events?limit=&eventType=&severity=&actorUserId=&targetUserId=&clientId=` | Exists\* | Today returns a plain `AuditEvent[]` (newest first, `limit` default 50, max 200). |

The audit endpoint is implemented under `/admin/api/audit-events` and returns a
plain array (newest first, `limit` default 50, max 200), mapped by
`toAuditEvent` so `metadataJson` is exposed as `metadata`. The UI treats the
array as a single page.

**Deferred enhancement**: wrap the audit response as `{ items, nextCursor }` and
add cursor pagination + a date-range filter, to match the other list endpoints.

## Resolved Decisions (B-07)

- Pagination is **cursor-based** over the prefixed-ULID `id`, descending
  (newest first), `limit` default 20 / max 100. See `src/admin/admin-pagination.ts`.
- Endpoints live in a dedicated **`AdminApiController`** (`@Controller('admin/api')`),
  guarded by `AdminGuard`, with mutations additionally behind
  `AdminRecentAuthGuard` + `AdminCsrfGuard`.
- Create/update mutations return the **enriched detail shape** (`UserDetail`,
  `GroupDetail`, `ClientDetail`) by re-composing after the write.
- Remaining follow-up: user status change does not yet return revocation counts
  (`revoked*Count`); the UI already treats them as optional.
