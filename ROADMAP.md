# Internal ID Project Roadmap

Last updated: 2026-06-26

This roadmap is the implementation tracker for Internal ID.

Agent should read this file before making implementation changes. The companion
architecture document is `INTERNAL_OIDC_IDENTITY_PROVIDER_GUIDE.md`.

## 1. Project Intent

Internal ID is an internal authentication and SSO provider.

It is the source of truth for internal users, credentials, groups, profiles, and
account lifecycle state. It authenticates users and emits identity claims through
OpenID Connect. It does not decide application-specific permissions for client
applications.

The guiding boundary:

```text
Internal ID proves who a user is.
Client applications decide what that user can do.
```

## 2. Current Status

| Area                    | Status      | Notes                                                                                                                                                    |
| ----------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture guide      | Done        | `INTERNAL_OIDC_IDENTITY_PROVIDER_GUIDE.md` exists and is the main design reference.                                                                      |
| Roadmap                 | In Progress | This file defines implementation tracking.                                                                                                               |
| Application code        | Done        | Modular NestJS identity provider, admin surface, OIDC endpoints, sample client, and operations paths now exist.                                          |
| Database schema         | Done        | Internal ID-owned entities, reviewed migrations, rollback verification, and bootstrap seed strategy now exist.                                           |
| Better Auth integration | Done        | Better Auth mounts inside NestJS, guardrails block unsupported request shapes, schema coexistence is documented, and local protocol wrappers are tested. |
| Tests                   | Done        | Unit, protocol, security, sample-client, lint, typecheck, build, audit, and CI commands are wired.                                                       |
| Deployment              | Done        | Docker, Compose, CI, metrics, cleanup jobs, and operations runbooks now exist.                                                                           |

## 3. Locked Decisions

These decisions should not be changed casually.

| Decision             | Chosen Direction                                                                  |
| -------------------- | --------------------------------------------------------------------------------- |
| Product name         | Internal ID                                                                       |
| Architecture         | Modular monolith                                                                  |
| Runtime              | Node.js                                                                           |
| Language             | TypeScript                                                                        |
| Framework            | NestJS                                                                            |
| Auth substrate       | Better Auth                                                                       |
| OAuth/OIDC substrate | Better Auth OAuth Provider plugin with OIDC compatibility                         |
| JWT/JWKS support     | Better Auth JWT plugin or compatible Better Auth-supported JWT/JWKS path          |
| ORM                  | TypeORM                                                                           |
| Durable database     | PostgreSQL                                                                        |
| Initial sessions     | PostgreSQL-backed unless Better Auth requires a different internal representation |
| Ephemeral store      | PostgreSQL first; Redis may be added later                                        |
| Login UI             | Server-rendered pages owned by `auth.company.com`                                 |
| Admin management UI  | Standalone React app later; backend must expose hardened admin JSON APIs first     |
| Provider role        | Identity provider only                                                            |
| App authorization    | Owned by client applications                                                      |

## 4. Non-Negotiable Scope Boundaries

Internal ID must support:

- OIDC Authorization Code flow.
- PKCE with `S256`.
- Provider-owned login.
- Internal users, groups, credentials, profiles, and lifecycle state.
- ID tokens as JWTs.
- Short-lived access tokens.
- Opaque refresh tokens where enabled.
- Refresh token rotation.
- JWKS discovery.
- UserInfo.
- Token revocation.
- Provider logout.
- Audit events for security-sensitive actions.
- Admin-managed trusted clients.

Internal ID must not support in the MVP:

- Social login.
- SAML.
- SCIM.
- External IdP federation.
- Self-service public registration.
- Self-service dynamic OIDC client registration.
- OAuth password grant.
- OAuth client credentials grant.
- OAuth device flow.
- OAuth implicit flow.
- OIDC hybrid flow.
- App-specific permissions inside provider claims.
- Public consumer identity.

## 5. On Track Signals

The project is on track when:

- New work preserves the boundary between identity and app authorization.
- Better Auth is used behind a local NestJS integration layer.
- Unsupported OAuth/OIDC capabilities are rejected and tested.
- PostgreSQL constraints protect important invariants.
- TypeORM migrations are committed and reproducible.
- Security-sensitive state changes are transactional.
- Each protocol endpoint has positive and negative tests.
- Admin actions produce audit events.
- The public discovery document advertises only supported behavior.
- The implementation remains a modular monolith.

## 6. Off Track Signals

The project is drifting if:

- App permissions such as `can_delete_invoice` or `project_admin` appear in provider claims.
- Client applications collect user passwords.
- Better Auth calls are scattered across unrelated modules.
- Dynamic client registration becomes available without a deliberate decision.
- `client_credentials`, `password`, `device_code`, implicit, or hybrid flows work.
- Redirect URI validation uses wildcard, prefix, or partial matching.
- Refresh tokens are stored raw.
- Authorization codes are stored raw.
- Provider sessions become JWT cookies.
- TypeORM `synchronize` is enabled in production-like environments.
- Migrations are generated but not reviewed.
- Token issuance or refresh rotation happens outside transactions.
- Audit events are skipped for admin or token-sensitive actions.

## 7. Source Of Truth Files

| File                                                                     | Purpose                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `ROADMAP.md`                                                             | Implementation plan, task tracker, phase gates, and agent orientation.                           |
| `INTERNAL_OIDC_IDENTITY_PROVIDER_GUIDE.md`                               | Architecture and engineering blueprint.                                                          |
| `src/app.module.ts`                                                      | Top-level module wiring for the modular monolith shell.                                          |
| `src/main.ts`                                                            | NestJS bootstrap and runtime entrypoint.                                                         |
| `src/config/app-config.module.ts`                                        | Global config loading and environment validation.                                                |
| `src/database/data-source.ts`                                            | TypeORM CLI data source entrypoint.                                                              |
| `src/database/typeorm.config.ts`                                         | Shared TypeORM configuration factory.                                                            |
| `src/database/entities/`                                                 | Internal ID-owned TypeORM entity definitions.                                                    |
| `src/database/migrations/1718107200000-create-internal-id-foundation.ts` | Initial reviewed PostgreSQL schema migration.                                                    |
| `src/database/scripts/bootstrap.ts`                                      | Idempotent bootstrap seed path for the first admin/group/client records.                         |
| `src/database/scripts/cleanup-expired.ts`                                | Scheduled cleanup path for expired authorization codes, provider sessions, and refresh tokens.   |
| `src/database/scripts/verify-migrations.ts`                              | Disposable migration run and rollback verification script.                                       |
| `src/better-auth/better-auth.module.ts`                                  | Better Auth integration boundary shell.                                                          |
| `src/better-auth/better-auth.factory.ts`                                 | Better Auth runtime factory for PostgreSQL, JWT, and OIDC plugin wiring.                         |
| `src/better-auth/better-auth.controller.ts`                              | NestJS mount point for Better Auth routes under `/api/auth`.                                     |
| `src/better-auth/BETTER_AUTH_SPIKE.md`                                   | Phase 3 findings and unresolved Better Auth constraints.                                         |
| `src/better-auth/BETTER_AUTH_OWNERSHIP.md`                               | Current coexistence decision between Better Auth-managed and Internal ID-owned schema.           |
| `src/metrics/metrics.module.ts`                                          | Prometheus-style metrics endpoint and request recording.                                         |
| `sample-client/src/server.ts`                                            | Runnable sample internal OIDC client using Authorization Code + PKCE.                            |
| `sample-client/src/oidc-client.ts`                                       | Sample OIDC helpers for PKCE, code exchange, ID token validation, and local app sessions.        |
| `Dockerfile`                                                             | Production container image definition.                                                           |
| `docker-compose.yml`                                                     | Local app and PostgreSQL runtime definition.                                                     |
| `.github/workflows/ci.yml`                                               | CI verification for build, typecheck, lint, tests, migrations, and dependency audit.             |
| `docs/OPERATIONS.md`                                                     | Deployment, environment, backup, cleanup, metrics, alerting, key rotation, and incident runbook. |
| `docs/CLIENT_INTEGRATION.md`                                             | Internal application integration guide for OIDC, local sessions, and logout boundaries.          |
| `docs/ADMIN_GUIDE.md`                                                    | Admin guide for access model, users, groups, clients, audit, and operational actions.            |
| `docs/SECURITY_TEST_MATRIX.md`                                           | Security test coverage matrix and explicit residual gaps.                                        |

When code exists, update this table with entrypoints such as `src/app.module.ts`,
`src/better-auth/better-auth.config.ts`, and `src/database/data-source.ts`.

## 8. Status Legend

Use these labels when updating task status.

| Status         | Meaning                                                    |
| -------------- | ---------------------------------------------------------- |
| `Not Started`  | No implementation exists.                                  |
| `In Progress`  | Work has started but is not accepted.                      |
| `Blocked`      | Cannot continue without a decision or external dependency. |
| `Needs Review` | Implementation exists but needs inspection or tests.       |
| `Done`         | Acceptance criteria are met and tests pass.                |
| `Deferred`     | Intentionally postponed.                                   |

## 9. Phase Gate Summary

| Phase | Name                          | Status | Primary Exit Gate                                                                                                        |
| ----- | ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| 0     | Project Setup Decisions       | Done   | Stack, package manager, Better Auth feasibility, and repo conventions are locked.                                        |
| 1     | NestJS Foundation             | Done   | App boots with NestJS, TypeORM, PostgreSQL, Better Auth integration shell, and health check.                             |
| 2     | Data Model And Migrations     | Done   | Initial PostgreSQL schema is created by TypeORM migrations and verified with rollback on a disposable database.          |
| 3     | Better Auth Integration Spike | Done   | Better Auth mounts in NestJS, PostgreSQL-backed schema inspection works, and local wrappers enforce protocol boundaries. |
| 4     | Authentication And Sessions   | Done   | Active users can log in and receive secure provider sessions.                                                            |
| 5     | Admin Bootstrap               | Done   | Admins can manage users, groups, clients, and audit-relevant state.                                                      |
| 6     | OIDC Authorization            | Done   | Valid auth requests issue one-time authorization codes; invalid requests are rejected safely.                            |
| 7     | Token Issuance And JWKS       | Done   | Code exchange issues verifiable ID/access tokens and UserInfo works.                                                     |
| 8     | Refresh Tokens And Revocation | Done   | Refresh rotation, replay detection, and revocation work transactionally.                                                 |
| 9     | Security Hardening            | Done   | Negative protocol tests, rate limits, CSRF, XSS protections, and audit coverage are in place.                            |
| 10    | Operations And Deployment     | Done   | Local and production-like deployment paths exist with backups, logging, metrics, and cleanup jobs.                       |
| 11    | Client Integration Readiness  | Done   | A sample internal client can complete the full Authorization Code + PKCE flow.                                           |

## 10. Execution Plan

This section turns the roadmap into a working sequence. The intent is to keep
the team on one critical path, reduce early rework, and make phase completion
observable from the repo.

### 10.1 Execution Principles

- Finish phase gates in order unless an explicit dependency exception is noted.
- Prefer thin vertical slices over broad parallel implementation.
- Treat Better Auth feasibility as an early blocker, not a late integration task.
- Commit migrations only after ownership boundaries are written down.
- Do not build admin or OIDC controllers on top of ambiguous client/token models.
- Each milestone must leave the repo in a runnable, testable state.

### 10.2 Milestone Sequence

| Milestone | Covers   | Target Outcome                                                               | Blocking Inputs                             | Required Repo Artifacts                                                 |
| --------- | -------- | ---------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| M0        | Phase 0  | Remaining stack and repo decisions are locked.                               | Architecture guide, Better Auth docs review | Updated roadmap decisions, Node/package manager files                   |
| M1        | Phase 1  | NestJS app boots locally with config, logging, DB wiring, and test commands. | M0                                          | Nest scaffold, env validation, TypeORM config, health check             |
| M2        | Phase 2  | Initial schema exists as reviewed migrations with rollback.                  | M0, M1                                      | Entities, migrations, ownership document, seed plan                     |
| M3        | Phase 3  | Better Auth can be constrained to Internal ID rules.                         | M0, M1, M2                                  | Better Auth spike module, findings doc, failing/passing protocol checks |
| M4        | Phase 4  | Users can log in and receive secure provider sessions.                       | M1, M2, M3                                  | Login/logout flow, session storage, auth audit events                   |
| M5        | Phase 5  | Admin bootstrap path exists for users, groups, and clients.                  | M2, M4                                      | Initial admin bootstrap, temporary admin pages/controllers, audit trail |
| M6        | Phase 6  | Authorization endpoint contract works for code + PKCE only.                  | M3, M4, M5                                  | Discovery route, authorize flow, negative tests                         |
| M7        | Phase 7  | Token exchange, JWKS, and UserInfo work with signed ID tokens.               | M3, M6                                      | Signing keys, token exchange, claim release, JWKS                       |
| M8        | Phase 8  | Refresh rotation, replay detection, and revocation are transactional.        | M7                                          | Refresh token model, rotation logic, revocation endpoints               |
| M9        | Phase 9  | Security hardening and protocol abuse protections are in place.              | M4, M6, M7, M8                              | Rate limits, CSRF/XSS protections, audit coverage, negative suites      |
| M10       | Phase 10 | Local and production-like operations path is documented and runnable.        | M1-M9                                       | Docker/dev infra, CI, observability, cleanup jobs                       |
| M11       | Phase 11 | Sample internal client completes end-to-end login flow.                      | M6-M10                                      | Sample client app/config, integration guide, final e2e suite            |

### 10.3 Critical Path

```text
M0 -> M1 -> M2 -> M3 -> M4 -> M5 -> M6 -> M7 -> M8 -> M9 -> M10 -> M11
```

Parallel work is allowed only when it does not weaken this chain. Examples:

- SSR template evaluation can happen during M0 while package manager decisions are being finalized.
- Logging and request-context work can proceed in parallel inside M1.
- Seed strategy drafting can start during M2 before all entities are finished.
- Security test case authoring can begin during M6 and expand through M9.

### 10.4 Milestone Exit Evidence

Each milestone is only `Done` when the repo contains all of the following:

- Code or configuration implementing the milestone scope.
- Automated checks relevant to the milestone.
- Updated roadmap status rows.
- Updated source-of-truth file table when new entrypoints are introduced.
- Short implementation notes where a non-obvious Better Auth or OIDC constraint was discovered.

### 10.5 Current Backend Follow-Up Queue

These are the next executable backend tasks based on the current implementation
state. An agent should work from this queue before pulling lower-priority tasks
from later phases.

| Order | Task ID | Why It Comes Next                                                                 | Expected Output                                                                 |
| ----- | ------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1     | B-01    | Refresh token rotation relies on database locking and replay handling.            | PostgreSQL-backed integration/concurrency tests for rotation, replay, and locks. |
| 2     | B-02    | The OAuth Provider plugin schema changed after replacing deprecated OIDC wiring.   | Reviewed migration for `oauthClient`, `oauthRefreshToken`, and OAuth field deltas. |
| 3     | B-03    | Better Auth inspect reports `scopes` type drift from the provider expectation.     | Explicit decision and migration or adapter handling for OAuth `scopes` columns. |
| 4     | B-04    | Database and unexpected service failures should not leak internals to clients.     | Global exception filter with safe HTTP responses and useful server logs.        |
| 5     | B-05    | In-memory rate limiting and request metrics are single-instance friendly only.     | Redis-backed login rate limiting plan and proper Prometheus client evaluation.  |
| 6     | B-06    | OIDC edge behavior must stay strict as Better Auth evolves underneath us.          | Protocol tests for prompt handling, discovery metadata, offline access, and logout/consent edges. |
| 7     | B-07    | Admin management will move to a standalone React app later.                        | Hardened `/admin/api/*` JSON contract with auth, CSRF/session posture, validation, pagination, and audit. |
| 8     | B-08    | Placeholder modules currently preserve intended domain boundaries.                 | Leave empty `IdentityModule` and `ClientsModule` in place until their API shape is decided. |

### 10.6 Decision Log For Phase 0

Use this table to lock the remaining setup decisions before scaffolding.

| Decision                            | Status | Chosen Value                                                                                                                                                            | Notes                                                                                                                                                    |
| ----------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager                     | Chosen | `pnpm`                                                                                                                                                                  | Good fit for a TypeScript monorepo-capable backend, deterministic lockfile behavior, and fast local installs without adding unusual runtime constraints. |
| Node.js version                     | Chosen | `Node.js 22 LTS`                                                                                                                                                        | Current long-term support baseline for a new NestJS service. Add `.nvmrc` and `engines.node` during scaffolding.                                         |
| Test runner                         | Chosen | `Vitest` for unit/integration, Playwright for e2e                                                                                                                       | Faster TypeScript-first feedback than Jest for service tests, plus browser-capable e2e coverage for SSR login and OIDC flows.                            |
| NestJS adapter                      | Chosen | Express                                                                                                                                                                 | Lower integration risk for Better Auth and SSR middleware than Fastify during the initial build.                                                         |
| Template engine                     | Chosen | Nunjucks                                                                                                                                                                | SSR-friendly, explicit auto-escaping, good partial/layout support, and no React frontend requirement for provider-owned pages.                           |
| Local dev database strategy         | Chosen | Docker Compose PostgreSQL                                                                                                                                               | Reproducible onboarding path with stable versions and no dependency on host-installed PostgreSQL.                                                        |
| Stable ID format                    | Chosen | Prefixed ULIDs                                                                                                                                                          | Sortable IDs help admin/audit workflows; prefixes make table origin obvious in logs and exports.                                                         |
| Better Auth table ownership         | Chosen | Better Auth owns base auth/session primitives; Internal ID owns lifecycle, groups, memberships, audit, client policy, redirect policy, token wrappers, and key metadata | Keep a single source of truth per concept. Wrapper tables are allowed where Better Auth data must be constrained by Internal ID policy.                  |
| Better Auth route mounting strategy | Chosen | Mount Better Auth inside `src/better-auth`, expose public contract through Internal ID controllers/wrappers                                                             | Preserves a clean boundary and makes it easier to hide unsupported features behind local validation.                                                     |
| Redis timing                        | Chosen | Deferred                                                                                                                                                                | Start with PostgreSQL-backed state; revisit Redis only for rate limiting, caches, or contention hot spots discovered after M3.                           |

### 10.6.1 Implementation Notes From Chosen Defaults

- `pnpm` and `Node.js 22 LTS` should be treated as the bootstrap baseline for all local scripts and CI.
- Express is the safer first adapter because the project risk is protocol correctness, not maximal HTTP throughput.
- Nunjucks should be configured with auto-escaping enabled by default and without arbitrary template execution extensions.
- Prefixed ULIDs should use consistent prefixes per aggregate, such as `usr_`, `grp_`, `cli_`, `ses_`, `cod_`, `rtk_`, and `aud_`.
- Better Auth should not become the policy surface. Internal ID modules remain responsible for lifecycle checks, redirect URI rules, claim release, token rotation, and audit emission.

### 10.7 Definition Of Done For The First Buildable Slice

The first meaningful buildable slice is M3, not M1.

M1 proves only that the application skeleton is alive. M3 is the first point at
which the repo has enough structure to validate whether Internal ID is viable on
top of Better Auth without architectural backtracking.

The team should therefore optimize the first implementation wave around:

- Locking setup decisions fast.
- Scaffolding once.
- Writing reviewed migrations once.
- Running the Better Auth spike before deeper feature work.

### 10.8 Placeholder Module Policy

`IdentityModule` and `ClientsModule` are intentional placeholders for now.

Do not delete, collapse, or force implementation into these modules simply
because they are empty. Keep them as boundary markers until the standalone React
admin app and the backend admin JSON contract make the required identity/client
service shapes clearer.

## 11. Phase 0: Project Setup Decisions

Objective: lock the remaining implementation conventions before scaffolding.

### Tasks

| ID    | Task                                       | Status | Acceptance Criteria                                                                   |
| ----- | ------------------------------------------ | ------ | ------------------------------------------------------------------------------------- |
| P0-01 | Choose package manager                     | Done   | One of npm, pnpm, yarn, or bun is selected and documented.                            |
| P0-02 | Choose Node.js version                     | Done   | `.nvmrc`, `.node-version`, or equivalent is added.                                    |
| P0-03 | Choose test runner                         | Done   | Unit and e2e test command strategy is documented.                                     |
| P0-04 | Choose NestJS platform adapter             | Done   | Express or Fastify adapter is chosen based on Better Auth compatibility.              |
| P0-05 | Choose template engine                     | Done   | SSR login/admin rendering path is selected.                                           |
| P0-06 | Choose local dev database strategy         | Done   | Docker Compose, local Postgres, or managed dev DB is documented.                      |
| P0-07 | Choose ID format                           | Done   | Stable IDs use a consistent format such as prefixed ULIDs or UUIDs.                   |
| P0-08 | Decide Better Auth table ownership         | Done   | A table ownership map exists before migrations are written.                           |
| P0-09 | Decide Better Auth route mounting strategy | Done   | Better Auth routes are either mounted directly or wrapped by Internal ID controllers. |
| P0-10 | Decide Redis timing                        | Done   | Redis is explicitly deferred or added for rate limits/TTL state.                      |

### Phase 0 Exit Criteria

- The stack remains NestJS, TypeScript, TypeORM, PostgreSQL, and Better Auth.
- Package manager and Node version are documented.
- Better Auth feasibility questions are captured before coding around them.
- No app-specific authorization is introduced.

## 12. Phase 1: NestJS Foundation

Objective: create a clean modular monolith skeleton.

### Expected Directory Shape

```text
src/
├── app.module.ts
├── main.ts
├── config/
├── database/
│   ├── data-source.ts
│   ├── migrations/
│   └── typeorm.module.ts
├── identity/
├── authentication/
├── oidc/
├── clients/
├── tokens/
├── admin/
├── audit/
└── better-auth/
```

### Tasks

| ID    | Task                         | Status | Acceptance Criteria                                                    |
| ----- | ---------------------------- | ------ | ---------------------------------------------------------------------- |
| P1-01 | Scaffold NestJS app          | Done   | App starts locally and exposes a basic route.                          |
| P1-02 | Add TypeScript strictness    | Done   | `tsconfig` enables strict checks appropriate for NestJS.               |
| P1-03 | Add config module            | Done   | Env vars are validated at startup.                                     |
| P1-04 | Add PostgreSQL config        | Done   | Database URL and pool settings are loaded from config.                 |
| P1-05 | Add TypeORM module           | Done   | NestJS can initialize TypeORM against PostgreSQL.                      |
| P1-06 | Add TypeORM data source      | Done   | CLI migrations can run using the same config model.                    |
| P1-07 | Add Better Auth module shell | Done   | Better Auth config is isolated in `src/better-auth`.                   |
| P1-08 | Add domain modules           | Done   | Identity, auth, OIDC, clients, tokens, admin, and audit modules exist. |
| P1-09 | Add request context          | Done   | Request ID can be attached to logs and audit events.                   |
| P1-10 | Add structured logging       | Done   | Logs include timestamp, level, request ID, and service context.        |
| P1-11 | Add health endpoint          | Done   | Health check reports app and database status without leaking secrets.  |
| P1-12 | Add lint and format commands | Done   | Commands exist and run cleanly on scaffold.                            |
| P1-13 | Add unit test command        | Done   | Empty or sample test suite passes.                                     |
| P1-14 | Add e2e test command         | Done   | Empty or sample e2e test suite passes.                                 |

### Phase 1 Exit Criteria

- `npm run start:dev` or equivalent starts the NestJS app.
- TypeORM can connect to PostgreSQL.
- Better Auth has a local integration module, even if not fully configured.
- No domain logic is implemented directly in `main.ts`.
- The app has repeatable lint, test, and migration commands.

## 13. Phase 2: Data Model And Migrations

Objective: create the durable PostgreSQL foundation.

### Data Ownership Rules

Before creating migrations, decide and document ownership:

| Domain                    | Preferred Owner                               | Notes                                                          |
| ------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| Base auth user identity   | Better Auth plus Internal ID profile wrapper  | Avoid duplicate source of truth.                               |
| Internal lifecycle status | Internal ID                                   | Required for pending, active, suspended, deactivated.          |
| Credentials               | Better Auth or Internal ID adapter            | Must hash passwords; do not duplicate raw credential concepts. |
| Groups                    | Internal ID                                   | Identity facts, not permissions.                               |
| Group memberships         | Internal ID                                   | Join table with audit metadata.                                |
| OIDC clients              | Better Auth or Internal ID wrapper            | Must enforce Internal ID restrictions.                         |
| Redirect URIs             | Better Auth or Internal ID wrapper            | Exact-match only.                                              |
| Authorization codes       | Better Auth or Internal ID wrapper            | Must be hashed and one-time-use.                               |
| Refresh tokens            | Better Auth or Internal ID wrapper            | Must be opaque, hashed, rotated, and auditable.                |
| Provider sessions         | Better Auth plus Internal ID wrapper          | Cookie must contain random secret, not user data.              |
| Signing keys              | Better Auth JWT plugin or Internal ID wrapper | Public JWKS, private key protected.                            |
| Audit events              | Internal ID                                   | Must be queryable and safe.                                    |

### Tasks

| ID    | Task                                             | Status | Acceptance Criteria                                                          |
| ----- | ------------------------------------------------ | ------ | ---------------------------------------------------------------------------- |
| P2-01 | Create table ownership document                  | Done   | Better Auth-owned and Internal ID-owned tables are listed.                   |
| P2-02 | Create user/profile entity                       | Done   | Stable `sub` is non-reassignable and not email-based.                        |
| P2-03 | Create lifecycle fields                          | Done   | `pending`, `active`, `suspended`, and `deactivated` states are represented.  |
| P2-04 | Create group entity                              | Done   | Group slug is unique and stable.                                             |
| P2-05 | Create group membership entity                   | Done   | `(user_id, group_id)` uniqueness is enforced.                                |
| P2-06 | Create client wrapper entity if needed           | Done   | Client type, status, allowed scopes, allowed claims, and TTLs are persisted. |
| P2-07 | Create redirect URI entity if needed             | Done   | Exact URI uniqueness per client is enforced.                                 |
| P2-08 | Create post-logout redirect URI entity if needed | Done   | Exact URI uniqueness per client is enforced.                                 |
| P2-09 | Create provider session wrapper if needed        | Done   | Session hash is unique and no user data is stored in cookies.                |
| P2-10 | Create authorization code wrapper if needed      | Done   | Code hash is unique; consumed state is represented.                          |
| P2-11 | Create refresh token wrapper if needed           | Done   | Token hash and family ID are represented.                                    |
| P2-12 | Create signing key wrapper if needed             | Done   | Key status lifecycle is represented.                                         |
| P2-13 | Create audit event entity                        | Done   | Safe metadata can be stored as JSONB.                                        |
| P2-14 | Add initial migration                            | Done   | Migration creates all Internal ID-owned tables.                              |
| P2-15 | Add rollback path                                | Done   | Migration can roll back in local dev.                                        |
| P2-16 | Add indexes                                      | Done   | Lookup and active-state indexes exist for token/session/code paths.          |
| P2-17 | Add seed strategy                                | Done   | Initial admin/client seed path is defined.                                   |

### PostgreSQL Requirements

- Use `TIMESTAMPTZ` for event, audit, token, and session timestamps.
- Use `JSONB` for safe structured metadata.
- Use unique constraints for normalized email, client ID, code hash, token hash,
  session hash, redirect URI registrations, and key IDs.
- Use partial indexes for active records where helpful.
- Use transactions and row locks for one-time-use state transitions.
- Avoid accidental cascading deletes for identity and audit history.

### Phase 2 Exit Criteria

- TypeORM migrations create and roll back the initial schema.
- Better Auth schema ownership is documented.
- No duplicate source of truth exists for users, credentials, clients, or tokens.
- The schema supports auditability and revocation.

## 14. Phase 3: Better Auth Integration Spike

Objective: prove Better Auth can be used without widening Internal ID scope.

### Required Spike Questions

| ID    | Question                                                | Status | Required Outcome                                                                               |
| ----- | ------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| P3-01 | Can Better Auth run cleanly inside NestJS?              | Done   | Working module integration exists.                                                             |
| P3-02 | Can Better Auth use PostgreSQL with the chosen adapter? | Done   | Tables are created or mapped.                                                                  |
| P3-03 | Can OAuth Provider expose OIDC discovery?               | Done   | Discovery metadata can be controlled.                                                          |
| P3-04 | Can unsupported response types be rejected?             | Done   | `token`, `id_token`, and hybrid flows fail.                                                    |
| P3-05 | Can unsupported grant types be rejected?                | Done   | `password`, `client_credentials`, and device grants fail.                                      |
| P3-06 | Can PKCE be required for all clients?                   | Done   | Missing PKCE and `plain` are rejected.                                                         |
| P3-07 | Can dynamic registration be disabled?                   | Done   | No self-service client registration is exposed.                                                |
| P3-08 | Can refresh token rotation behavior satisfy this guide? | Done   | Local family/replay semantics and token-path integration exist.                                |
| P3-09 | Can claims be shaped by client policy?                  | Done   | Additional claims and mounted userinfo output are constrained by client policy.                |
| P3-10 | Can audit hooks capture security events?                | Done   | Boundary, login, authorization, token, refresh, revocation, and admin audit paths are covered. |

### Better Auth Integration Rules

- Better Auth must live behind `src/better-auth`.
- Domain modules should use local services or interfaces, not direct Better Auth
  calls.
- If Better Auth supports a broad feature, Internal ID must configure it off or
  block it with route guards.
- Discovery metadata must advertise only Internal ID-supported behavior.
- Better Auth upgrades must run the protocol conformance test suite.

### Phase 3 Exit Criteria

- A minimal Better Auth sign-in path works.
- OAuth/OIDC routes can be mounted or wrapped.
- Unsupported features are proven disabled or blocked.
- Any Better Auth limitation is documented with a workaround or explicit risk.
- The project can move forward without violating the scope boundary.

## 15. Phase 4: Authentication And Sessions

Objective: users can authenticate through provider-owned SSR pages.

### Tasks

| ID    | Task                                 | Status | Acceptance Criteria                                                            |
| ----- | ------------------------------------ | ------ | ------------------------------------------------------------------------------ |
| P4-01 | Build SSR login page                 | Done   | Page renders from `auth.company.com` app with escaped content.                 |
| P4-02 | Add login CSRF protection            | Done   | POST login rejects missing or invalid CSRF token.                              |
| P4-03 | Integrate Better Auth email/password | Done   | Active users can authenticate.                                                 |
| P4-04 | Normalize login identifier           | Done   | Email lookup is case-insensitive and display casing is preserved where needed. |
| P4-05 | Enforce lifecycle checks             | Done   | Pending, suspended, and deactivated users cannot login.                        |
| P4-06 | Create provider session cookie       | Done   | Cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, path-scoped, and high entropy. |
| P4-07 | Rotate session after login           | Done   | Session fixation is prevented.                                                 |
| P4-08 | Add logout                           | Done   | Provider session cookie is cleared and session is revoked.                     |
| P4-09 | Add login rate limiting              | Done   | Account and IP rate limits exist without user enumeration.                     |
| P4-10 | Add generic login errors             | Done   | Unknown email and wrong password return same message.                          |
| P4-11 | Track `auth_time`                    | Done   | Session and ID token path can use recent authentication.                       |
| P4-12 | Audit login events                   | Done   | Success and failure events are written without secrets.                        |

### Phase 4 Tests

- Active user can log in.
- Pending user cannot log in.
- Suspended user cannot log in.
- Deactivated user cannot log in.
- Wrong password does not reveal whether account exists.
- Login creates a secure cookie.
- Logout clears provider session.
- Login form rejects invalid CSRF.
- XSS payload in user-controlled display fields is escaped.

### Phase 4 Exit Criteria

- Provider-owned login works without client apps collecting passwords.
- Provider session semantics are clear and secure.
- Login and logout are audited.

## 16. Phase 5: Admin Bootstrap

Objective: trusted admins can manage the initial internal identity system.

### Admin Capabilities

| Area     | MVP Capability                                                                        |
| -------- | ------------------------------------------------------------------------------------- |
| Users    | Create, edit profile, set status, force reset or temporary credential path.           |
| Groups   | Create, edit display data, add/remove users.                                          |
| Clients  | Create, disable, configure redirect URIs, scopes, claims, TTLs, refresh token policy. |
| Sessions | Revoke user sessions.                                                                 |
| Tokens   | Revoke refresh tokens where supported.                                                |
| Audit    | View security-sensitive event history.                                                |

### Tasks

| ID    | Task                             | Status | Acceptance Criteria                                  |
| ----- | -------------------------------- | ------ | ---------------------------------------------------- |
| P5-01 | Define admin authorization model | Done   | Provider-local admin rule is documented.             |
| P5-02 | Add admin guard                  | Done   | Non-admin users cannot access admin routes.          |
| P5-03 | Add recent-auth guard            | Done   | Sensitive actions require recent authentication.     |
| P5-04 | Build admin shell                | Done   | Temporary admin pages render safely.                 |
| P5-05 | User create/edit                 | Done   | Admin can create and update users.                   |
| P5-06 | User status changes              | Done   | Admin can suspend, reactivate, and deactivate users. |
| P5-07 | Group management                 | Done   | Admin can create groups and manage memberships.      |
| P5-08 | Client management                | Done   | Admin can create clients and disable clients.        |
| P5-09 | Redirect URI management          | Done   | Admin can add/remove exact redirect URIs.            |
| P5-10 | Claim policy management          | Done   | Admin can configure allowed claims per client.       |
| P5-11 | Refresh token policy management  | Done   | Admin can enable/disable refresh tokens per client.  |
| P5-12 | Audit viewer                     | Done   | Admin can view relevant audit events.                |
| P5-13 | Admin audit events               | Done   | Every admin mutation writes an audit event.          |

### Phase 5 Exit Criteria

- Initial admin bootstrap is possible.
- Admin actions are authorized and audited.
- Admin UI escapes all user-controlled data.
- Admin can configure clients without dynamic public registration.

## 17. Phase 6: OIDC Authorization

Objective: implement the authorization endpoint contract.

### Public Contract

```text
GET /.well-known/openid-configuration
GET /oauth/authorize
```

The public provider must support only:

```text
response_type=code
code_challenge_method=S256
```

### Tasks

| ID    | Task                                    | Status | Acceptance Criteria                                                        |
| ----- | --------------------------------------- | ------ | -------------------------------------------------------------------------- |
| P6-01 | Implement discovery route               | Done   | Metadata advertises only supported capabilities.                           |
| P6-02 | Implement authorize route mount/wrapper | Done   | Better Auth route is exposed through Internal ID contract.                 |
| P6-03 | Validate client status                  | Done   | Disabled or unknown clients cannot authorize.                              |
| P6-04 | Validate redirect URI                   | Done   | Exact-match registered URI only.                                           |
| P6-05 | Validate response type                  | Done   | Anything other than `code` is rejected.                                    |
| P6-06 | Validate scope                          | Done   | `openid` is required and scopes must be client-allowed.                    |
| P6-07 | Require state                           | Done   | Missing state is rejected.                                                 |
| P6-08 | Require PKCE                            | Done   | Missing challenge is rejected.                                             |
| P6-09 | Reject `plain` PKCE                     | Done   | Only `S256` is accepted.                                                   |
| P6-10 | Handle unauthenticated users            | Done   | User is sent to provider login and auth request state is preserved safely. |
| P6-11 | Handle existing provider session        | Done   | User can continue without re-entering password.                            |
| P6-12 | Support `prompt=login`                  | Done   | Reauthentication is forced.                                                |
| P6-13 | Support `prompt=none`                   | Done   | No UI is shown; error is returned if not authenticated.                    |
| P6-14 | Issue authorization code                | Done   | Code is high entropy, hashed server-side, short-lived, one-time-use.       |
| P6-15 | Redirect with code and state            | Done   | Successful authorization redirects only to validated URI.                  |
| P6-16 | Audit code issuance                     | Done   | Safe audit event is written.                                               |

### Phase 6 Tests

- Valid request returns code and state.
- Unknown client is rejected.
- Disabled client is rejected.
- Invalid redirect URI is rejected.
- Prefix, wildcard, and trailing-slash redirect variants are rejected.
- Missing `openid` is rejected.
- Disallowed scope is rejected.
- Missing state is rejected.
- Missing PKCE is rejected.
- `code_challenge_method=plain` is rejected.
- `response_type=token` is rejected.
- `response_type=id_token` is rejected.
- Hybrid response types are rejected.

### Phase 6 Exit Criteria

- Authorization endpoint behavior matches the guide.
- Discovery metadata does not over-advertise Better Auth capabilities.
- All negative protocol tests pass.

## 18. Phase 7: Token Issuance And JWKS

Objective: exchange authorization codes for signed identity tokens and short-lived access tokens.

### Public Contract

```text
POST /oauth/token
GET /.well-known/jwks.json
GET /oauth/userinfo
```

### Tasks

| ID    | Task                                | Status | Acceptance Criteria                                              |
| ----- | ----------------------------------- | ------ | ---------------------------------------------------------------- |
| P7-01 | Configure signing keys              | Done   | Active signing key exists and is not committed to source.        |
| P7-02 | Publish JWKS                        | Done   | Public keys are available with correct `kid`.                    |
| P7-03 | Implement token route mount/wrapper | Done   | Better Auth token behavior is constrained by Internal ID rules.  |
| P7-04 | Validate authorization code         | Done   | Code hash exists, is unexpired, unconsumed, and client-bound.    |
| P7-05 | Validate redirect URI on exchange   | Done   | Redirect URI matches original authorization request.             |
| P7-06 | Validate PKCE verifier              | Done   | Verifier matches stored S256 challenge.                          |
| P7-07 | Authenticate confidential clients   | Done   | Client secret validation works where applicable.                 |
| P7-08 | Reject unsupported grants           | Done   | `password`, `client_credentials`, and device grants fail.        |
| P7-09 | Issue ID token                      | Done   | JWT validates against JWKS and includes expected claims.         |
| P7-10 | Issue access token                  | Done   | Token is short-lived and scoped to provider resources.           |
| P7-11 | Apply claim release policy          | Done   | Claims are intersection of scopes, client policy, and user data. |
| P7-12 | Implement UserInfo                  | Done   | UserInfo returns allowed claims for valid access token.          |
| P7-13 | Audit token issuance                | Done   | Safe event is written without raw tokens.                        |

### Token Rules

- ID tokens are JWTs.
- Access tokens are short-lived.
- Refresh tokens, if issued, are opaque and handled in Phase 8.
- Raw authorization codes are never stored.
- Raw client secrets are never stored.
- Raw tokens are never logged.

### Phase 7 Tests

- Valid code exchange returns token response.
- Reusing authorization code fails.
- Expired authorization code fails.
- Wrong client fails.
- Wrong redirect URI fails.
- Wrong PKCE verifier fails.
- Disabled user cannot exchange code.
- Disabled client cannot exchange code.
- ID token validates against JWKS.
- ID token `iss`, `aud`, `sub`, `exp`, `iat`, and `nonce` are correct.
- UserInfo respects scopes and client claim policy.
- Unsupported grants are rejected.

### Phase 7 Exit Criteria

- Client apps can validate ID tokens using JWKS.
- Token endpoint does not expose unsupported OAuth grants.
- Claim release is constrained and tested.

## 19. Phase 8: Refresh Tokens And Revocation

Objective: safely support long-lived client sessions where explicitly allowed.

### Public Contract

```text
POST /oauth/token
POST /oauth/revoke
```

### Tasks

| ID    | Task                                    | Status | Acceptance Criteria                                                   |
| ----- | --------------------------------------- | ------ | --------------------------------------------------------------------- |
| P8-01 | Enable per-client refresh token policy  | Done   | Refresh tokens are issued only when scope and client policy allow.    |
| P8-02 | Generate opaque refresh tokens          | Done   | Token has high entropy and is not a JWT.                              |
| P8-03 | Store refresh token hashes              | Done   | Raw refresh token is not stored.                                      |
| P8-04 | Add refresh token family tracking       | Done   | Family ID and parent/child links are represented.                     |
| P8-05 | Implement rotation                      | Done   | Each successful refresh revokes old token and issues new token.       |
| P8-06 | Implement replay detection              | Done   | Reuse of rotated token revokes family and emits critical audit event. |
| P8-07 | Add idle expiration                     | Done   | Token cannot refresh after idle expiry.                               |
| P8-08 | Add absolute expiration                 | Done   | Token cannot refresh after absolute expiry.                           |
| P8-09 | Add revocation endpoint                 | Done   | Client can revoke refresh token.                                      |
| P8-10 | Return success for unknown revoke token | Done   | Token probing is not possible.                                        |
| P8-11 | Revoke on user deactivation             | Done   | Deactivated user cannot refresh.                                      |
| P8-12 | Revoke on client disable                | Done   | Disabled client cannot refresh.                                       |
| P8-13 | Audit refresh events                    | Done   | Rotation, revocation, and replay are audited.                         |

### PostgreSQL Atomicity Requirements

- Rotation must occur inside a transaction.
- Current token row must be locked before state transition.
- Exactly one refresh request can rotate a token successfully.
- Replay detection must be deterministic after commit.
- Family revocation must update all active family rows.

### Phase 8 Tests

- Allowed client receives refresh token when requesting `offline_access`.
- Disallowed client does not receive refresh token.
- Refresh token rotates on use.
- Old refresh token reuse triggers replay handling.
- Revoked refresh token cannot be used.
- Expired refresh token cannot be used.
- Suspended or deactivated user cannot refresh.
- Disabled client cannot refresh.
- Unknown revocation token returns success without disclosure.

### Phase 8 Exit Criteria

- Refresh token behavior is safe under retries and concurrency.
- Replay detection is audited at critical severity.
- Revocation works for app logout, admin actions, and deactivation.

## 20. Phase 9: Security Hardening

Objective: make the provider safe enough for internal production use.

### Tasks

| ID    | Task                           | Status | Acceptance Criteria                                            |
| ----- | ------------------------------ | ------ | -------------------------------------------------------------- |
| P9-01 | Add CSRF protection to forms   | Done   | Login and admin forms reject invalid CSRF.                     |
| P9-02 | Add strict security headers    | Done   | HSTS, CSP, Referrer-Policy, and nosniff are set appropriately. |
| P9-03 | Add XSS escaping tests         | Done   | User/client/group strings render escaped in SSR pages.         |
| P9-04 | Add login rate limits          | Done   | Account and IP limits are enforced.                            |
| P9-05 | Add token endpoint rate limits | Done   | Abuse is slowed without leaking sensitive details.             |
| P9-06 | Add generic OAuth errors       | Done   | Errors do not expose secrets or internal state.                |
| P9-07 | Add secret redaction           | Done   | Logs redact tokens, passwords, secrets, keys, and codes.       |
| P9-08 | Add dependency audit workflow  | Done   | Dependency risk can be checked in CI.                          |
| P9-09 | Add protocol conformance tests | Done   | Unsupported flows remain rejected.                             |
| P9-10 | Add migration tests            | Done   | Migrations can run from empty database in CI.                  |
| P9-11 | Add authorization tests        | Done   | Admin and recent-auth guards are tested.                       |
| P9-12 | Add audit coverage tests       | Done   | Sensitive actions produce audit events.                        |

### Phase 9 Exit Criteria

- Security headers are present.
- SSR pages escape user-controlled data.
- Negative OAuth/OIDC tests pass.
- Secrets are not logged.
- Rate limits exist for login and token endpoints.

## 21. Phase 10: Operations And Deployment

Objective: make the system deployable, observable, and maintainable.

### Tasks

| ID     | Task                             | Status | Acceptance Criteria                                                            |
| ------ | -------------------------------- | ------ | ------------------------------------------------------------------------------ |
| P10-01 | Add Dockerfile                   | Done   | Production image builds reproducibly.                                          |
| P10-02 | Add Docker Compose for dev       | Done   | App and PostgreSQL can run locally.                                            |
| P10-03 | Add migration command            | Done   | Migrations can run before app start.                                           |
| P10-04 | Add environment reference        | Done   | Required env vars are documented.                                              |
| P10-05 | Add backup guidance              | Done   | PostgreSQL backup and restore path is documented.                              |
| P10-06 | Add cleanup jobs                 | Done   | Expired codes, sessions, tokens, and stale keys are cleaned.                   |
| P10-07 | Add metrics                      | Done   | Login, token, refresh, error, latency, and session metrics exist.              |
| P10-08 | Add alerts                       | Done   | Failed login spikes, replay detection, key compromise, and token errors alert. |
| P10-09 | Add key rotation runbook         | Done   | Normal and emergency rotation are documented.                                  |
| P10-10 | Add incident checklist           | Done   | Compromised secret/key/user/client paths are documented.                       |
| P10-11 | Add production config validation | Done   | App refuses insecure production config.                                        |
| P10-12 | Add CI pipeline                  | Done   | Lint, typecheck, tests, and migrations run in CI.                              |

### Phase 10 Exit Criteria

- A new developer can run the system locally.
- CI prevents obvious breakage.
- Production config cannot start with insecure defaults.
- Operators have backup, restore, cleanup, and key rotation guidance.

## 22. Phase 11: Client Integration Readiness

Objective: prove an internal app can use Internal ID correctly.

### Tasks

| ID     | Task                                  | Status   | Acceptance Criteria                                               |
| ------ | ------------------------------------- | -------- | ----------------------------------------------------------------- |
| P11-01 | Create sample confidential client     | Done     | Server-rendered sample app can complete code flow.                |
| P11-02 | Create sample public client if needed | Deferred | Public client can complete PKCE without secret.                   |
| P11-03 | Validate ID token in sample client    | Done     | Client checks signature, issuer, audience, expiration, and nonce. |
| P11-04 | Establish local app session           | Done     | Sample app uses its own session cookie after login.               |
| P11-05 | Test provider logout                  | Done     | Provider logout clears provider session and redirects safely.     |
| P11-06 | Test app logout                       | Done     | App clears local session and revokes refresh token if present.    |
| P11-07 | Document client integration guide     | Done     | Internal app owners know how to integrate safely.                 |

### Phase 11 Exit Criteria

- A sample internal app can complete login.
- Client-side validation rules are documented.
- Logout limitations are clear.
- App owners are told not to treat provider access tokens as app sessions unless
  that is an intentional architecture decision.

## 23. Cross-Cutting Testing Strategy

Every phase should add tests proportional to risk.

### Required Test Types

| Type                     | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| Unit tests               | Domain policies, validators, claim release, lifecycle checks.     |
| Integration tests        | TypeORM repositories, transactions, Better Auth adapter behavior. |
| E2E tests                | Browser/login/OIDC flows through NestJS routes.                   |
| Protocol negative tests  | Unsupported OAuth/OIDC requests must fail.                        |
| Migration tests          | Schema can be created from scratch and rolled forward.            |
| Security rendering tests | SSR pages escape user-controlled content.                         |
| Concurrency tests        | Authorization code and refresh token one-time-use behavior.       |

### Required Protocol Negative Tests

- `response_type=token` rejected.
- `response_type=id_token` rejected.
- Hybrid response types rejected.
- Missing `openid` rejected.
- Missing `state` rejected.
- Missing PKCE rejected.
- `code_challenge_method=plain` rejected.
- Unregistered redirect URI rejected.
- Wildcard redirect URI rejected.
- Prefix redirect URI rejected.
- Unsupported `grant_type=password` rejected.
- Unsupported `grant_type=client_credentials` rejected.
- Unsupported device grant rejected.
- Reused authorization code rejected.
- Reused rotated refresh token triggers replay behavior.

## 24. Audit Event Requirements

Audit events must be safe and useful.

### Required Event Categories

| Event                                | Minimum Severity |
| ------------------------------------ | ---------------- |
| `user.login.succeeded`               | info             |
| `user.login.failed`                  | warning          |
| `user.logout.succeeded`              | info             |
| `user.created`                       | info             |
| `user.updated`                       | info             |
| `user.suspended`                     | warning          |
| `user.deactivated`                   | warning          |
| `group.created`                      | info             |
| `group.membership.added`             | info             |
| `group.membership.removed`           | info             |
| `client.created`                     | warning          |
| `client.updated`                     | warning          |
| `client.disabled`                    | warning          |
| `client.secret.rotated`              | warning          |
| `oidc.authorization_code.issued`     | info             |
| `oidc.authorization_code.consumed`   | info             |
| `oidc.token.issued`                  | info             |
| `oidc.refresh_token.rotated`         | info             |
| `oidc.refresh_token.revoked`         | info             |
| `oidc.refresh_token.replay_detected` | critical         |
| `signing_key.created`                | warning          |
| `signing_key.activated`              | warning          |
| `signing_key.retired`                | warning          |
| `signing_key.compromised`            | critical         |

### Never Store In Audit Metadata

- Passwords.
- Raw authorization codes.
- Raw refresh tokens.
- Raw access tokens.
- Raw ID tokens.
- Client secrets.
- Private keys.
- CSRF tokens.
- Session cookie values.

## 25. Claim Release Rules

Claims must be identity facts, not app permissions.

Release is the intersection of:

```text
provider-supported claims
requested scopes
client allowed claims
current user data
current user status
```

### Allowed Claim Families

| Family         | Examples                                                                             |
| -------------- | ------------------------------------------------------------------------------------ |
| Protocol       | `iss`, `sub`, `aud`, `exp`, `iat`, `jti`                                             |
| Authentication | `auth_time`, `nonce`, `amr` later if MFA is added                                    |
| Profile        | `email`, `email_verified`, `name`, `given_name`, `family_name`, `preferred_username` |
| Organization   | `groups`, `profile_type`                                                             |
| Client context | `client_id`, `scope` for access tokens                                               |
| Traceability   | `jti`                                                                                |

### Forbidden Claim Examples

- `can_delete_invoice`
- `can_merge_repository`
- `billing_superuser`
- `project_admin`
- `can_view_customer_pii`
- Any client-specific entitlement

## 26. Better Auth Guardrail Checklist

Run this checklist after initial integration and after every Better Auth upgrade.

| Check                                                           | Status |
| --------------------------------------------------------------- | ------ |
| Discovery advertises only `response_types_supported: ["code"]`. | Done   |
| Discovery advertises only allowed grant types.                  | Done   |
| Dynamic client registration route is absent or blocked.         | Done   |
| Password grant fails.                                           | Done   |
| Client credentials grant fails.                                 | Done   |
| Device flow fails.                                              | Done   |
| Implicit flow fails.                                            | Done   |
| Hybrid flow fails.                                              | Done   |
| PKCE is required.                                               | Done   |
| `plain` PKCE fails.                                             | Done   |
| Redirect URI matching is exact.                                 | Done   |
| Refresh token storage does not expose raw tokens.               | Done   |
| Claim release can be constrained per client.                    | Done   |
| Audit hooks are available or wrapped.                           | Done   |

## 27. Data And Transaction Checklist

Use this checklist before accepting token/session-related work.

| Check                                                                      | Status |
| -------------------------------------------------------------------------- | ------ |
| Authorization code lookup uses hash, not raw code.                         | Done   |
| Authorization code consumption is atomic.                                  | Done   |
| Consumed authorization code cannot be reused under concurrency.            | Done   |
| Refresh token lookup uses hash, not raw token.                             | Done   |
| Refresh token rotation locks the current row.                              | Done   |
| Refresh token replay revokes the token family.                             | Done   |
| User deactivation revokes sessions and refresh tokens.                     | Done   |
| Client disable blocks new authorization immediately.                       | Done   |
| Client disable blocks token exchange immediately.                          | Done   |
| Signing key activation/retirement is tracked.                              | Done   |
| Audit event writes are included in sensitive transactions where practical. | Done   |

## 28. Documentation Deliverables

| Document                        | Status      | Purpose                                                     |
| ------------------------------- | ----------- | ----------------------------------------------------------- |
| Architecture guide              | Done        | Full design blueprint.                                      |
| Roadmap                         | In Progress | Implementation tracking and agent orientation.              |
| Local development guide         | Done        | How to run app, Postgres, migrations, and tests.            |
| Environment variables reference | Done        | Required config and safe defaults.                          |
| Client integration guide        | Done        | How internal apps use OIDC safely.                          |
| Admin guide                     | Done        | How admins manage users, groups, clients, and sessions.     |
| Operations runbook              | Done        | Deployment, backups, cleanup jobs, key rotation, incidents. |
| Security test matrix            | Done        | Required conformance and negative tests.                    |

## 29. Definition Of Done

A task is done only when:

- Code is implemented in the correct module boundary.
- TypeScript compiles.
- Lint passes.
- Unit or integration tests cover the behavior where appropriate.
- Security-sensitive behavior has negative tests.
- Migrations are committed for schema changes.
- Logs and audit events do not include secrets.
- Docs or this roadmap are updated if behavior changes.
- The implementation does not expand Internal ID scope.

## 30. First Implementation Slice

The first implementation slice is complete and should now be treated as
historical context.

It established:

- NestJS TypeScript app structure.
- PostgreSQL local dev setup.
- TypeORM config and migration flow.
- Better Auth integration boundary.
- Health, metrics, lint, typecheck, test, and CI commands.
- Bootstrap seed path for the initial admin and sample client.

Current implementation work should follow the backend follow-up queue in
section 10.5 rather than restarting the scaffold-era sequence.

## 31. Open Questions

| ID   | Question                                            | Impact                                      | Status |
| ---- | --------------------------------------------------- | ------------------------------------------- | ------ |
| Q-01 | Which package manager will be used?                 | Affects lockfile and scripts.               | Open   |
| Q-02 | Which Node.js version will be required?             | Affects runtime and CI.                     | Open   |
| Q-03 | Express or Fastify NestJS adapter?                  | Affects Better Auth route integration.      | Open   |
| Q-04 | Which template engine for SSR pages?                | Affects login/admin UI.                     | Open   |
| Q-05 | Will Redis be used in MVP?                          | Affects rate limiting and TTL state.        | Open   |
| Q-06 | What ID format should Internal ID use?              | Affects schema and public `sub`.            | Open   |
| Q-07 | Which Better Auth tables are source-of-truth?       | Affects migrations and adapters.            | Open   |
| Q-08 | How will signing private keys be encrypted at rest? | Affects key storage and deployment secrets. | Open   |
| Q-09 | What is the initial admin bootstrap mechanism?      | Affects first deployment safety.            | Open   |
| Q-10 | What are production token/session TTL values?       | Affects security and UX.                    | Open   |

## 32. Risk Register

| Risk                                                                | Likelihood | Impact | Mitigation                                                        |
| ------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------- |
| Better Auth exposes broader OAuth features than Internal ID allows. | Medium     | High   | Add route guards and protocol conformance tests.                  |
| Better Auth schema conflicts with TypeORM schema ownership.         | Medium     | High   | Decide table ownership before migrations.                         |
| Refresh token replay handling is weaker than required.              | Medium     | High   | Wrap or own refresh token behavior if needed.                     |
| Dynamic registration is accidentally exposed.                       | Low        | High   | Block routes and test absence.                                    |
| Provider claims drift into app permissions.                         | Medium     | High   | Enforce claim release policy and review claims.                   |
| Session/cookie settings are unsafe in production.                   | Medium     | High   | Validate production config at startup.                            |
| Authorization code consumption has race bugs.                       | Medium     | High   | Use PostgreSQL atomic update or row locks plus concurrency tests. |
| Admin surface becomes under-protected.                              | Medium     | High   | Require admin guard, recent auth, CSRF, and audit tests.          |
| Audit logs leak secrets.                                            | Low        | High   | Redaction tests and safe metadata policy.                         |
| Key rotation is not operationally tested.                           | Medium     | High   | Add key rotation runbook and staging rehearsal.                   |

## 33. Agent Working Instructions

When a future agent session works on this project:

1. Read `ROADMAP.md`.
2. Read the relevant sections of `INTERNAL_OIDC_IDENTITY_PROVIDER_GUIDE.md`.
3. Check `git status --short`.
4. Identify the current phase and task IDs.
5. Keep changes scoped to the current phase unless the user asks otherwise.
6. Update task statuses when work is completed.
7. Add tests for security-sensitive behavior.
8. Do not expand supported OAuth/OIDC scope without updating the guide and roadmap.
9. Do not bypass Better Auth guardrails without documenting why.
10. Do not introduce app-specific authorization into Internal ID claims.

## 34. Immediate Next Step

Continue from the current backend follow-up queue.

The next concrete repo changes should be:

- add PostgreSQL-backed refresh-token rotation concurrency tests
- materialize and review the Better Auth OAuth Provider schema deltas
- decide how to handle OAuth `scopes` column type drift
- add a global exception filter for safe database/service failure responses
- keep `IdentityModule` and `ClientsModule` empty until their admin/API boundary is clearer
