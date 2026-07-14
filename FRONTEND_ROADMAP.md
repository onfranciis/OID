# Internal ID Admin UI Roadmap

This roadmap governs the **standalone React admin app** for Internal ID. It is the
frontend companion to `ROADMAP.md`, which tracks the backend. Where the two
overlap, `ROADMAP.md` remains the source of truth for backend contracts and the
`ROADMAP.md` "Locked Decisions" table remains authoritative for product-level
choices.

## 1. Intent

Internal ID's backend phases (0 through 11) are complete. The admin surface today
is a static server-rendered placeholder at `/admin` that lists four areas
(Users, Groups, Clients, Audit) without interactivity. This roadmap replaces that
placeholder with a real, single-page React application that lets administrators
manage users, groups, OIDC clients, and review audit events from a
provider-owned surface.

The admin app is an **internal operational tool**. It should feel quiet,
utilitarian, and built for scanning, comparison, and repeated action, not
marketing or illustration.

## 2. Current Status

| Area                    | Status      | Notes                                                                                                     |
| ----------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| Frontend roadmap        | In Progress | This file. Defines the admin UI build and tracking.                                                       |
| Admin SPA               | In Progress | F0–F4 done: shell + auth plumbing, Users, Clients, and Groups (member picker, lockout guards) on MSW.     |
| Backend admin JSON API  | Blocked     | Read/list endpoints do not exist. Tracked as `B-07` in `ROADMAP.md`. This UI depends on it (see Sec. 13). |
| Existing admin surface  | Done        | Static SSR placeholder (`src/admin/views/index.njk`) with non-interactive tiles.                          |

## 3. Locked Decisions

These decisions are settled for this workstream and should not change casually.

| Decision              | Chosen Direction                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| App type              | Client-rendered single-page application (SPA)                                                        |
| Build tool            | Vite                                                                                                 |
| Framework             | React + TypeScript                                                                                    |
| Routing               | React Router                                                                                          |
| Server state / data   | TanStack Query                                                                                        |
| Styling               | Tailwind CSS                                                                                          |
| Accessible primitives | Radix UI (dialogs, menus, toasts, popovers)                                                           |
| Forms / validation    | react-hook-form + zod                                                                                 |
| API mocking (dev)     | MSW (Mock Service Worker)                                                                             |
| Unit / component test | Vitest + React Testing Library                                                                        |
| End-to-end test       | Playwright (reuse existing `playwright.config.ts`)                                                    |
| Serving model         | Same-origin: Vite build served by NestJS at `/admin` with SPA fallback                               |
| Auth model            | Reuse existing provider session cookie + double-submit CSRF; no new auth surface                     |
| Location              | `web/admin/` inside this repository                                                                   |
| Package manager       | pnpm (Node 22), matching the backend                                                                  |

## 4. Scope Boundaries

The admin app must:

- Manage internal users (create, edit profile, lifecycle status changes).
- Manage groups (create, edit, membership add/remove).
- Manage OIDC clients (create, edit policy, status, redirect URIs, secret rotation).
- Browse audit events read-only with filters.
- Authenticate exclusively through the existing provider session; never mint or
  store its own tokens.

The admin app must not:

- Introduce a second authorization model. Admin power is decided by the backend
  (`src/admin/ADMIN_AUTHORIZATION.md`): active user in the bootstrap admin group.
- Persist secrets, CSRF tokens, or session material in `localStorage` or
  `sessionStorage`.
- Add a separate login UI. Login and re-authentication happen on the existing
  provider-owned `/login` page.
- Talk to Better Auth, the database, or any origin other than `/admin/api/*` on
  the same host.

## 5. Integration Constraints

Verified against the backend. The UI is built around these.

| Constraint          | Reality                                                                                                   | UI Requirement                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Session cookie      | `internal_id_provider_session`, HttpOnly. Enforced by `AdminGuard` / `AdminAccessService`.                | UI cannot read it. Learn identity via a whoami bootstrap call; `401/403` redirects to `/login`.  |
| CSRF                | Double-submit; cookie is `HttpOnly; Path=/admin`; token echoed via `x-csrf-token` header.                 | UI cannot read the cookie. Fetch a token from bootstrap and attach `x-csrf-token` to mutations.  |
| Recent-auth gate    | Mutations require session `authTime` within `AUTHENTICATION_ADMIN_RECENT_AUTH_WINDOW_SECONDS` (600s).     | Detect the mutation `403`, drive re-authentication, then retry the original request.             |
| Cookie / route names | Come from `src/config/configuration.ts`; only the `/admin` base path is fixed.                           | Never hardcode cookie names client-side; rely on same-origin cookies and the fixed base path.    |
| Serving             | No CORS, cookie-parser, or static serving in `src/main.ts` today.                                         | Same-origin build served by Nest (Phase F6). No CORS needed; cookies stay `SameSite=Lax`.        |

## 6. Assumed Backend Contract (dependency B-07)

The UI targets the contract below and mocks it with MSW until the backend delivers
it. The authoritative, living version lives in `docs/ADMIN_API_CONTRACT.md`. All
routes are under `/admin/api/*`, session-cookie authenticated, JSON in and out,
with the NestJS error envelope `{ statusCode, message, error }`.

| Method + Path                                | Purpose                                             |
| -------------------------------------------- | --------------------------------------------------- |
| `GET /admin/api/session`                     | Whoami + `isAdmin` + fresh `csrfToken` (sets cookie) |
| `GET /admin/api/users?cursor=&limit=&status=&q=` | Paginated user list                             |
| `GET /admin/api/users/:id`                   | User detail                                          |
| `GET /admin/api/groups` / `:id`              | Group list / detail (with memberships)              |
| `GET /admin/api/clients` / `:id`             | Client list / detail (with redirect URIs)           |
| `GET /admin/api/audit-events?...`            | Audit list (exists today at `/admin/audit-events`)  |
| `POST /admin/api/...` mutations              | Existing create/update/status/secret operations     |

Mutation request/response shapes are taken directly from the input interfaces
already defined in `AdminUserService`, `AdminGroupService`, and
`AdminClientService`. Read (list/detail) shapes are new and defined in the
contract doc. Any drift between the assumed and delivered contract is reconciled
in Phase F6.

## 7. Application Sections And Screens

This is the functional specification of the site: every section, what it holds,
and what it does. Routes are client-side under the `/admin` base path. Every
screen consumes only the contract in Section 6.

### 7.1 App Shell (wraps every screen)

| Element              | Holds / Does                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Header bar           | Product name "Internal ID Admin"; current admin's display name (from `GET /admin/api/session`); sign-out action posting to the existing `/logout`. |
| Left navigation      | Links: Overview, Users, Groups, Clients, Audit. Active-route highlight, keyboard navigable, collapsible on narrow viewports. |
| Content outlet       | Page title, breadcrumb (e.g. Users / Jane Doe), and the active screen.                                                  |
| Toast region         | Radix Toast for mutation success/failure notifications; errors show the server `message`.                              |
| Re-auth dialog       | Radix Dialog mounted at the root. Opens whenever any mutation returns the recent-auth `403`; explains that sensitive actions need a fresh login, sends the admin to `/login?returnTo=<current path>`, and retries the original mutation after return. |
| Route guard          | On boot, calls `GET /admin/api/session`. `401` → hard redirect to `/login?returnTo=/admin`. `isAdmin: false` / `403` → the Access Denied screen (7.7). |

### 7.2 Overview — `/admin`

Purpose: orientation and jump-off point after login. Deliberately thin — it only
uses data already available from the list endpoints, so it adds no backend scope.

| Holds                                  | Does                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| Welcome line with the actor's name      | Confirms who is signed in.                                                        |
| Domain tiles (Users, Groups, Clients, Audit) | Navigate to each section; each tile shows a first-page count where cheaply available. |
| Recent activity panel                   | Last ~10 audit events (`GET /admin/api/audit-events?limit=10`), each linking into the Audit section. |
| Quick actions                           | "Create user", "Create client", "Create group" buttons that deep-link to the create forms. |

### 7.3 Users — `/admin/users`

The workhorse section: manage internal identities and their lifecycle.

**User list — `/admin/users`**

| Holds                                                                 | Does                                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Table: display name, email, username, profile type, status badge, created date | Row click opens the detail screen.                                              |
| Search box (`q`: matches email / username / display name)              | Debounced server-side search.                                                          |
| Status filter (pending / active / suspended / deactivated)             | Server-side filter via `status=`.                                                      |
| Cursor pagination ("Load more")                                        | Fetches the next page via `nextCursor`.                                                |
| "Create user" button                                                   | Opens the create form.                                                                 |

**Create user — `/admin/users/new`**

Form fields mirror `AdminCreateUserInput`: email (required), display name
(required), given name, family name, username, profile type select
(employee / contractor / service, default employee). zod validation mirrors the
backend `normalize*` rules; a `409` from the server renders as an inline
"already in use" error on the email/username field. On success: toast + navigate
to the new user's detail. New users are created with status `pending`
(backend-enforced).

**User detail — `/admin/users/:id`**

| Panel               | Holds                                                                                       | Does                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Profile             | Email (+ verified indicator), username, display/given/family name, profile type, created/updated timestamps | "Edit" toggles an inline form (`POST /admin/api/users/:id`, partial update).                     |
| Lifecycle           | Current status badge; allowed transitions (activate, suspend, reactivate, deactivate)        | Status change via `POST /admin/api/users/:id/status`. Suspend/deactivate require a Radix confirm dialog. Deactivation warns that all sessions and refresh tokens are revoked, and surfaces the returned revocation counts in the success toast. |
| Groups              | The user's memberships (slug, display name)                                                   | Add via group picker (`POST /admin/api/groups/:groupId/members/:userId`); remove with confirm (`.../remove`). Warns when removing the actor's own membership in the bootstrap admin group (self-lockout risk). |
| Recent activity     | Audit events where this user is actor or target (`targetUserId=` / `actorUserId=` filters)   | Read-only; links into the Audit section with the filter pre-applied.                                       |

### 7.4 Groups — `/admin/groups`

Groups drive application-facing membership claims **and** admin authorization
itself, so this section carries extra guardrails.

**Group list — `/admin/groups`**

| Holds                                                       | Does                                        |
| ------------------------------------------------------------ | --------------------------------------------- |
| Table: slug, display name, description, member count, created date | Row click opens detail.               |
| Search box, cursor pagination, "Create group" button         | Same patterns as Users.                      |

**Create group — `/admin/groups/new`**

Fields: slug (required, lowercased like the backend), display name (required),
description. Slug conflicts (`409`) render inline.

**Group detail — `/admin/groups/:id`**

| Panel      | Holds                                                          | Does                                                                                                  |
| ---------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Metadata   | Slug, display name, description, created/updated                | Inline edit (`POST /admin/api/groups/:id`). Editing the bootstrap admin group's slug shows a prominent warning: the slug is referenced by `BOOTSTRAP_ADMIN_GROUP_SLUG` and renaming it can revoke all admin access. |
| Members    | Table of members: display name, email, user status badge        | Add member via a user picker (searches `GET /admin/api/users?q=`); remove with confirm. Removing yourself from the bootstrap admin group requires typed confirmation (self-lockout guard). |

### 7.5 Clients — `/admin/clients`

OIDC relying-party management: registration, protocol policy, redirect URIs, and
credentials.

**Client list — `/admin/clients`**

| Holds                                                                                     | Does                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Table: client ID, name, type badge (confidential/public), status badge, owner team, secret indicator, created date | Row click opens detail.  |
| Status filter, search, pagination, "Create client" button                                  | Same patterns as Users.                   |

**Create client — `/admin/clients/new`**

Fields mirror `AdminCreateClientInput`: client ID (required, immutable after
create — the form says so), name (required), type select (confidential default),
owner team; a collapsed "Policy" section exposes allowed scopes (chips, default
`openid`), allowed claims (chips, default `sub`), require-PKCE toggle (default
on), access/ID token TTLs (default 900s), and refresh-token policy (allow toggle
gating idle/absolute TTL fields, defaults 7d/30d). On success: navigate to
detail; if the client is confidential, prompt to rotate/issue the first secret.

**Client detail — `/admin/clients/:id`** (tabbed)

| Tab           | Holds                                                                                                  | Does                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Policy        | Name, owner team, allowed scopes/claims chip editors, PKCE toggle, token TTL fields, refresh-token policy | Inline edit via `POST /admin/api/clients/:id`. Refresh TTL fields disabled unless refresh tokens allowed. |
| Redirect URIs | List of registered URIs                                                                                  | Add form (client-side validation mirrors backend: absolute http/https, no fragment; duplicates → inline `409`). Remove with confirm dialog. |
| Credentials   | Secret state ("secret set" / "no secret issued"), rotation history via audit link                        | "Rotate secret" (confidential only) → confirm dialog warning the old secret stops working → **reveal-once panel**: plaintext secret with copy-to-clipboard, never rendered again after dismissal, never cached or stored. |
| Status        | Active/disabled state                                                                                    | Disable/reactivate via `POST /admin/api/clients/:id/status` with confirmation; disabling warns that OIDC flows for this client stop immediately. |
| Activity      | Audit events for this client (`clientId=` filter)                                                        | Read-only; links into Audit with the filter pre-applied.                                                  |

### 7.6 Audit — `/admin/audit`

Read-only forensic view. The only section whose read endpoint exists today.

| Holds                                                                                             | Does                                                                        |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Filter bar: event type, severity (info/warning/critical), actor user ID, target user ID, client ID, limit | Server-side filters mapped to the existing query params.               |
| Event table: timestamp, event type, severity badge, actor, target, client, IP address              | Newest first; manual refresh button; deep-linkable filters via URL search params (so other sections can pre-filter). |
| Row expansion                                                                                       | Pretty-printed read-only JSON metadata viewer plus user agent string.        |

### 7.7 Session And Error Surfaces

| Surface              | Holds / Does                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Auth redirect        | Unauthenticated (`401`) → full-page redirect to `/login?returnTo=/admin`; the SPA never renders a login form itself.  |
| Access denied        | Authenticated but not admin (`403` / `isAdmin: false`): a quiet full-page notice ("Admin access denied") with a sign-out action. No nav is rendered. |
| Recent-auth dialog   | Described in 7.1; the single reusable flow for all mutation `403`s from `AdminRecentAuthGuard`.                       |
| Not found            | Unknown client-side route or entity `404`: in-shell "not found" state with a link back to the section list.           |
| Error boundary       | Unexpected render/query failure: in-shell error state with a retry button; never exposes stack traces.                |
| Empty states         | Every list has a purposeful empty state with the section's primary create action.                                     |

## 8. Directory Shape

```text
web/admin/
  index.html
  vite.config.ts        # base '/admin/', React + Tailwind v4 plugins, vitest config
  tsconfig.json
  src/
    main.tsx
    app/
      router.tsx          # route table + auth boundary
      api-client.ts       # fetch wrapper: credentials, x-csrf-token, error mapping
      query.ts            # TanStack Query client + key factories
      session.tsx         # whoami bootstrap + recent-auth re-login flow
    components/            # shared UI (tables, dialogs, form fields on Radix)
    features/
      overview/
      users/
      clients/
      groups/
      audit/
    mocks/
      handlers.ts         # MSW handlers = executable spec of the contract
      browser.ts
    styles/
      theme.css           # Tailwind v4 CSS-first @theme tokens mirrored from index.njk palette
```

Tailwind v4 is configured CSS-first: theme tokens live in `styles/theme.css`
via `@theme`; there is no `tailwind.config.ts`. The package is standalone
(own `pnpm-lock.yaml`) so the backend lockfile is untouched; root
`admin:*` scripts delegate with `pnpm -C web/admin`.

The Vite build output is emitted to a path NestJS serves in Phase F6.

## 9. Status Legend

| Status         | Meaning                                                    |
| -------------- | ---------------------------------------------------------- |
| `Not Started`  | No implementation exists.                                  |
| `In Progress`  | Work has started but is not accepted.                      |
| `Blocked`      | Cannot continue without a decision or external dependency. |
| `Needs Review` | Implementation exists but needs inspection or tests.       |
| `Done`         | Acceptance criteria are met and tests pass.                |
| `Deferred`     | Intentionally postponed.                                   |

## 10. Phase Gate Summary

| Phase | Name                             | Status      | Primary Exit Gate                                                                                  |
| ----- | -------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| F0    | Scaffolding And Toolchain        | Done        | App boots with `pnpm admin:dev`; lint, typecheck, and build pass.                                  |
| F1    | Shell, Routing, Auth, Data Layer | Done        | Unauthenticated load redirects; authenticated load renders shell + actor name against MSW.         |
| F2    | Users                            | Done        | Full user list/detail/create/edit/status against MSW with cache invalidation and error surfacing.  |
| F3    | Clients                          | Done        | Full client management incl. reveal-once secret rotation and redirect URIs against MSW.            |
| F4    | Groups                           | Done        | Full group management incl. membership add/remove and lockout guards against MSW.                  |
| F5    | Audit And Overview               | Not Started | Filterable, paginated audit browsing against MSW and the real audit endpoint; Overview assembled.  |
| F6    | Nest Integration (Same-Origin)   | Blocked     | `pnpm build && pnpm start` serves the SPA at `/admin`; real session + CSRF flow end-to-end.        |
| F7    | Hardening And Tests              | Not Started | Green typecheck/lint/build/test/e2e; a11y pass; security review; docs updated.                    |

Phase F6 is `Blocked` on backend `B-07`. Phases F0 through F5 and F7's
component-level tests proceed unblocked against MSW.

## 11. Execution Plan

### 11.1 Principles

- Build against MSW so frontend progress never waits on the backend.
- Treat the MSW handlers as an executable specification of the contract the
  backend must satisfy; keep them and `docs/ADMIN_API_CONTRACT.md` in sync.
- Reuse backend validation rules and field shapes rather than inventing new ones.
- Ship one domain end-to-end at a time; each domain phase is independently
  demoable and implements its Section 7 screen spec exactly.

### 11.2 Phase F0: Scaffolding And Toolchain

Tasks:

- Create the `web/admin/` Vite + React + TypeScript app.
- Add Tailwind, Radix, TanStack Query, React Router, react-hook-form, zod, MSW.
- Mirror the existing palette from `src/admin/views/index.njk`
  (`--accent #1d6f5f`, ink `#17211d`, muted `#61706a`, line `#d8ded9`,
  surface `#ffffff`, page `#f4f7f5`) into the Tailwind theme for visual
  continuity, with 8px radii.
- Align ESLint/Prettier with the repo (`eslint.config.mjs`, `.prettierrc`) and
  pin Node 22 (`.nvmrc`).
- Add pnpm scripts: `admin:dev`, `admin:build`, `admin:test`, `admin:lint`.

Exit criteria: `pnpm admin:dev` serves a blank shell; lint, typecheck, and
`pnpm admin:build` all pass.

### 11.3 Phase F1: Shell, Routing, Auth, Data Layer

Tasks:

- App shell per Section 7.1: header with actor name, left nav, content outlet,
  toast region, root-mounted re-auth dialog.
- `api-client.ts`: `fetch` with `credentials: 'include'`, auto-attach
  `x-csrf-token` on mutations, and map the `{ statusCode, message, error }`
  envelope to typed errors.
- `query.ts`: TanStack Query client plus per-domain key factories.
- `session.tsx`: whoami bootstrap on load; `401` → `/login?returnTo=/admin`;
  non-admin → Access Denied screen; the reusable recent-auth flow that
  intercepts mutation `403`s, prompts re-auth, and retries.
- MSW baseline handlers for `GET /admin/api/session`.

Exit criteria: an unauthenticated load redirects to login; an authenticated load
renders the shell with the actor's name; a simulated recent-auth `403` triggers
the re-login flow (all against MSW).

### 11.4 Phase F2: Users

Implement Section 7.3 in full: list (cursor pagination, status filter, search),
detail with profile/lifecycle/groups/activity panels, create, edit, and status
transitions with confirmation for destructive changes. Client-side validation
mirrors `AdminUserService` normalization; `409`s render inline; deactivation
surfaces revocation counts.

Exit criteria: full user CRUD against MSW with query invalidation on success and
server errors surfaced inline.

### 11.5 Phase F3: Clients

Implement Section 7.5 in full: list, create (immutable clientId, policy
defaults), tabbed detail (policy editing, redirect URIs with backend-matching
validation, reveal-once secret rotation, status changes with warnings, activity
links).

Exit criteria: full client management against MSW, including the reveal-once flow.

### 11.6 Phase F4: Groups

Implement Section 7.4 in full: list, create, detail with metadata editing and
membership management via user picker, plus both lockout guards (admin-group
slug warning; typed confirmation for removing yourself from the admin group).

Exit criteria: full group management against MSW including guardrails.

### 11.7 Phase F5: Audit And Overview

Implement Sections 7.6 and 7.2: the filterable audit stream with expandable
metadata and URL-driven filters, then the Overview screen assembled from
already-built list queries and the audit feed.

Exit criteria: audit browsing against MSW and against the real
`GET /admin/audit-events`; Overview renders tiles, recent activity, and quick
actions.

### 11.8 Phase F6: Nest Integration (Same-Origin Serving)

Blocked on backend `B-07`. Tasks:

- Serve the Vite build from NestJS at `/admin` with SPA fallback (non-`/admin/api`
  routes return `index.html`) in `src/main.ts`.
- Retire the SSR placeholder render in `src/admin/admin.controller.ts` /
  `admin-page.service.ts` in favor of the SPA.
- Point the app at the real `/admin/api/*` endpoints; relegate MSW to tests.
- Reconcile any contract drift with the delivered backend.

Exit criteria: `pnpm build && pnpm start` serves the SPA at
`http://localhost:3000/admin`; real session and CSRF cookies drive whoami and at
least one live mutation end-to-end.

### 11.9 Phase F7: Hardening And Tests

Tasks: loading / empty / error states and error boundaries across all screens
per Section 7.7; accessibility pass (Radix a11y, keyboard navigation, focus
management); Vitest + React Testing Library coverage for forms, pagination,
error mapping, and the CSRF / recent-auth interceptors; Playwright e2e happy
paths (login then manage each domain) reusing `playwright.config.ts` and the
bootstrap seed; a security pass (no tokens in web storage, CSRF on every
mutation, reliance on React/Radix escaping with no `dangerouslySetInnerHTML`).
Update `docs/ADMIN_GUIDE.md` and `docs/SECURITY_TEST_MATRIX.md`.

Exit criteria: green typecheck, lint, build, unit, and e2e; accessibility and
security passes complete; docs updated.

## 12. Cross-Cutting Requirements

- **Security**: attach `x-csrf-token` to every mutating request; on a mutation
  `403`, run the recent-auth re-login flow then retry; secrets are reveal-once and
  never cached; never write session/CSRF/secret material to web storage.
- **Lockout guards**: warn on bootstrap-admin-group slug edits; typed
  confirmation before removing your own admin membership.
- **Data**: TanStack Query with stable key factories per domain; invalidate
  affected queries on mutation success.
- **Forms**: react-hook-form + zod schemas that mirror backend `normalize*`
  rules so client and server validation agree.
- **UX**: operational density (tables, filters, scannable rows), 8px radii, no
  marketing chrome, consistent empty/loading/error treatment across sections.

## 13. Dependencies And Risks

- **Hard dependency**: the backend `/admin/api/*` read/API layer (`B-07` in
  `ROADMAP.md`). The UI cannot reach production without it. This roadmap defines
  the exact contract; F0 through F5 proceed on MSW; F6 swaps mocks for the real
  API.
- **Contract drift risk**: mitigated by keeping MSW handlers and
  `docs/ADMIN_API_CONTRACT.md` as a single, reviewed specification the backend
  builds to.
- **Session/CSRF coupling risk**: the SPA depends on same-origin serving so the
  HttpOnly cookies apply. Deviating to a separate origin would require CORS with
  credentials and cross-site cookie posture, which is explicitly out of scope.

## 14. Source Of Truth Files

- Backend roadmap and B-07 status: `ROADMAP.md`.
- Assumed API contract: `docs/ADMIN_API_CONTRACT.md`.
- Admin authorization model: `src/admin/ADMIN_AUTHORIZATION.md`.
- CSRF posture: `src/admin/admin-csrf.service.ts`.
- Field / validation shapes: `src/admin/admin-user.service.ts`,
  `admin-group.service.ts`, `admin-client.service.ts`.
- Cookie / config names: `src/config/configuration.ts`.
- Visual tokens: `src/admin/views/index.njk`.
- e2e harness: `playwright.config.ts`.

## 15. Verification

- **Dev (unblocked)**: `pnpm admin:dev` with MSW; exercise each domain screen
  against its Section 7 spec; verify the auth redirect and recent-auth re-login
  flows.
- **Static checks**: `pnpm admin:build`, typecheck, and lint pass.
- **Component / unit**: Vitest + React Testing Library for forms, pagination,
  error mapping, and interceptors.
- **Integration (F6, once B-07 lands)**: `pnpm build && pnpm start`; load
  `http://localhost:3000/admin`; confirm real session + CSRF drive whoami and a
  live mutation; run Playwright e2e (login then create/edit in each domain)
  against a seeded database.
