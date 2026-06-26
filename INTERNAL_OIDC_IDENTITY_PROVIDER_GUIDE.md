# Internal OIDC Identity Provider Engineering Guide

This document is the architectural and engineering blueprint for an internal
Identity Provider (IdP) that serves as the source of truth for users and provides
Single Sign-On (SSO) to internal applications through OpenID Connect (OIDC).

The platform is intentionally narrow:

- It is an OIDC provider.
- It is the source of truth for internal users, groups, credentials, and account lifecycle state.
- It authenticates users and emits identity claims.
- It does not decide application-specific permissions.
- It is built as a monolith first, with clean internal boundaries.
- It is implemented with NestJS and TypeScript.
- It uses TypeORM for database entities, repositories, and migrations.
- It uses PostgreSQL as the durable SQL database.
- It is built on Better Auth for authentication and OAuth/OIDC provider
  machinery.
- It does not support social login, SAML, SCIM, external IdP federation, client credentials, device flow, or fine-grained authorization.

The core principle:

```text
Internal ID proves who a user is.
Client applications decide what that user can do.
```

## Table of Contents

1. [Scope and Non-Goals](#1-scope-and-non-goals)
2. [Core Concepts](#2-core-concepts)
3. [System Architecture](#3-system-architecture)
4. [Domain Model](#4-domain-model)
5. [OIDC Protocol Surface](#5-oidc-protocol-surface)
6. [Claims Strategy](#6-claims-strategy)
7. [Client Application Model](#7-client-application-model)
8. [Authentication Model](#8-authentication-model)
9. [Session Model](#9-session-model)
10. [Token Model](#10-token-model)
11. [Refresh Token Rotation](#11-refresh-token-rotation)
12. [Cryptography and JWKS](#12-cryptography-and-jwks)
13. [Authorization Code + PKCE Flow](#13-authorization-code--pkce-flow)
14. [Server-Rendered Web App Flow](#14-server-rendered-web-app-flow)
15. [Logout and Revocation](#15-logout-and-revocation)
16. [Storage Boundaries](#16-storage-boundaries)
17. [Database Schema Blueprint](#17-database-schema-blueprint)
18. [HTTP Endpoint Reference](#18-http-endpoint-reference)
19. [Security Requirements](#19-security-requirements)
20. [Audit and Observability](#20-audit-and-observability)
21. [Admin Surface](#21-admin-surface)
22. [Operational Model](#22-operational-model)
23. [MVP Build Plan](#23-mvp-build-plan)
24. [Future Extensions](#24-future-extensions)

---

## 1. Scope and Non-Goals

### 1.1 In Scope

Internal ID is responsible for:

- Maintaining internal user records.
- Managing user lifecycle state.
- Storing password credentials securely.
- Authenticating users.
- Maintaining a provider-level SSO session.
- Registering trusted internal OIDC clients.
- Issuing OIDC authorization codes.
- Exchanging authorization codes for tokens.
- Supporting PKCE.
- Issuing ID tokens.
- Issuing access tokens for identity-facing provider resources such as `/userinfo`.
- Optionally issuing refresh tokens per client.
- Rotating refresh tokens on every use.
- Publishing OIDC discovery metadata.
- Publishing public signing keys through JWKS.
- Emitting stable identity claims.
- Recording security-sensitive audit events.
- Providing an admin interface for users, groups, clients, sessions, and audit logs.

### 1.2 Explicitly Out of Scope

Internal ID does not support:

- Social login.
- SAML.
- SCIM.
- External IdP federation.
- Login with Google, Microsoft, GitHub, Okta, or similar third-party providers.
- User self-registration for public users.
- Self-service OIDC client registration.
- Device authorization flow.
- Client credentials flow.
- Resource owner password credentials flow.
- Fine-grained app permissions.
- Entitlements such as `can_approve_invoice`.
- App-specific role decisions.
- Risk scoring engines.
- Consent marketplace behavior.
- Public consumer identity.

These exclusions are deliberate. An internal identity provider should be boring,
small, auditable, and difficult to misuse.

### 1.3 System Boundary

Internal ID owns authentication and identity.

Client applications own business authorization.

Example:

```text
Internal ID:
  "This is user usr_123. Their email is ana@company.com. They belong to the engineering group."

Project Management App:
  "Users in engineering may view engineering projects. Only project owners may edit this specific project."
```

Internal ID should never need to know what a project, invoice, ticket, payroll
record, or deployment pipeline is.

---

## 2. Core Concepts

### 2.1 Authentication

Authentication answers:

```text
Who is this user?
```

Examples:

- Verifying an email and password.
- Checking whether an account is active.
- Creating a provider login session.
- Reauthenticating before sensitive account changes.

### 2.2 Authorization

Authorization answers:

```text
What can this user do?
```

Internal ID does not make fine-grained authorization decisions for client
applications.

It may emit identity facts such as:

- User ID.
- Email.
- Name.
- Username.
- Groups.
- Employment status.
- Profile type.

It should not emit application permissions such as:

- `can_delete_invoice`.
- `can_merge_repository`.
- `can_view_customer_pii`.
- `project_admin`.
- `billing_superuser`.

### 2.3 SSO

Single Sign-On is the user experience goal.

A user authenticates once with Internal ID and can then access multiple approved
internal applications without re-entering their password each time.

This is enabled by the provider session:

```text
Browser has SSO cookie for auth.company.com
        |
        v
App redirects user to Internal ID
        |
        v
Internal ID sees active provider session
        |
        v
Internal ID redirects back with authorization code
```

### 2.4 OAuth 2.0

OAuth 2.0 is the authorization framework underneath OIDC.

For this platform, the only OAuth grant types used are:

- Authorization Code.
- Refresh Token, where enabled for a client.

The platform does not support:

- Password grant.
- Client credentials grant.
- Device code grant.
- Implicit flow.

### 2.5 OIDC

OpenID Connect adds authentication and identity on top of OAuth 2.0.

OIDC introduces:

- ID tokens.
- Standard identity claims.
- Discovery metadata.
- UserInfo endpoint.
- JWKS for signing key discovery.

### 2.6 PKCE

Proof Key for Code Exchange (PKCE) protects the authorization code flow from code
interception attacks.

PKCE is required for all public clients and recommended for all clients.

The platform should only accept:

```text
code_challenge_method=S256
```

The platform should reject:

```text
code_challenge_method=plain
```

---

## 3. System Architecture

### 3.1 Monolith-First Architecture

Internal ID should begin as a modular monolith.

The system should be deployed as one application, while keeping clear internal
domains:

```text
Internal_ID/
├── Identity
│   ├── Users
│   ├── Credentials
│   ├── Groups
│   └── Profiles
│
├── Authentication
│   ├── Login
│   ├── Sessions
│   ├── Password verification
│   └── Reauthentication
│
├── OIDC Provider
│   ├── Discovery
│   ├── Authorization endpoint
│   ├── Token endpoint
│   ├── UserInfo endpoint
│   ├── JWKS endpoint
│   └── Revocation endpoint
│
├── Clients
│   ├── Client registry
│   ├── Redirect URI validation
│   ├── Scope policy
│   └── Claim release policy
│
├── Tokens
│   ├── Authorization codes
│   ├── Access tokens
│   ├── ID tokens
│   ├── Refresh tokens
│   └── Signing keys
│
├── Admin
│   ├── User management
│   ├── Group management
│   ├── Client management
│   ├── Session management
│   └── Audit views
│
└── Audit
    ├── Security events
    ├── Admin events
    ├── Token events
    └── Authentication events
```

This structure allows future extraction of services if necessary, but avoids the
operational complexity of distributed identity infrastructure too early.

### 3.2 Recommended Runtime Shape

```text
                 +-----------------------+
                 | Browser               |
                 +-----------+-----------+
                             |
                             v
                 +-----------------------+
                 | Internal ID Monolith  |
                 | auth.company.com      |
                 +-----------+-----------+
                             |
           +-----------------+-----------------+
           |                                   |
           v                                   v
 +--------------------+              +--------------------+
 | SQL Database       |              | Ephemeral Store     |
 | Durable state      |              | TTL state           |
 +--------------------+              +--------------------+
```

The monolith talks to:

- A relational database for durable identity and configuration state.
- An ephemeral store for short-lived protocol state.
- A logging or event pipeline for audit and operational telemetry.

### 3.3 NestJS Implementation Shape

Internal ID should be implemented as a NestJS TypeScript application.

Recommended module layout:

```text
src/
├── app.module.ts
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

NestJS should provide:

- Module boundaries for the Internal ID domains.
- Dependency injection for services, repositories, policies, and adapters.
- Controllers for Internal ID-owned pages and wrapper endpoints.
- Guards for admin access, recent authentication, lifecycle checks, and protocol
  restrictions.
- Interceptors or middleware for request IDs, audit context, and security
  headers.
- Background jobs for cleanup, key lifecycle tasks, and stale-secret warnings.

Better Auth should be isolated behind a local NestJS integration module:

```text
better-auth/
├── better-auth.module.ts
├── better-auth.config.ts
├── better-auth.adapter.ts
└── better-auth.guard.ts
```

Internal ID code should not spread Better Auth calls throughout every module.
Instead, domain services should depend on small local interfaces for sessions,
users, clients, tokens, and OAuth/OIDC operations. This keeps Better Auth
replaceable if the provider boundary ever needs to move lower-level.

TypeORM should be the persistence layer for Internal ID-owned state.

Recommended TypeORM posture:

- Define entities inside the module that owns the domain concept.
- Keep migrations checked into source control.
- Disable automatic schema synchronization outside local experiments.
- Use explicit transactions for token exchange, refresh token rotation,
  session revocation, user deactivation, and client updates.
- Put cross-module query logic behind services or repositories instead of
  leaking raw query builder usage across the app.
- Prefer database constraints for uniqueness, foreign keys, and one-time-use
  invariants where possible.

Better Auth-managed tables must be handled deliberately:

- If Better Auth owns a table, document that ownership and do not duplicate the
  same data in a competing TypeORM entity.
- If Internal ID needs stronger domain semantics around Better Auth data, expose
  it through an adapter service rather than direct table access from unrelated
  modules.
- If Better Auth-generated migrations are used, review and commit them like any
  other production migration.
- If TypeORM migrations create Better Auth-compatible tables manually, keep that
  mapping documented near the Better Auth integration module.

### 3.4 Better Auth Substrate

Internal ID should be built on top of Better Auth.

Better Auth provides the lower-level authentication and OAuth/OIDC provider
machinery. Internal ID provides the product and security boundary around it:

- Internal user lifecycle rules.
- Internal group and profile model.
- Internal client approval workflow.
- Claim release policy.
- Audit event policy.
- Operational controls.
- Protocol restrictions required by this guide.

Recommended Better Auth posture:

- Use the OAuth Provider plugin with OIDC compatibility.
- Use the JWT plugin for asymmetric JWT signing and JWKS support.
- Use server-rendered Internal ID pages for provider-owned login, consent, or
  app disclosure flows.
- Treat admin management as a backend API first. A standalone React admin app
  can be added later, but it must call hardened Internal ID admin endpoints
  rather than bypassing the provider-local authorization model.
- Disable or block any Better Auth endpoint or grant that is outside the
  Internal ID contract.
- Keep dynamic client registration disabled unless explicitly introduced later.
- Configure all internal clients through the Internal ID admin surface or
  deployment-time seed data.
- After Better Auth or OAuth Provider plugin upgrades, inspect and review
  schema deltas before accepting them. Current follow-up work includes the
  OAuth Provider tables/fields and the provider `scopes` column shape.

The Better Auth configuration must enforce the Internal ID protocol surface:

| Capability | Internal ID Requirement |
| --- | --- |
| Response types | Only `code`. |
| Grant types | Only `authorization_code` and controlled `refresh_token`. |
| Client credentials grant | Disabled or rejected. |
| Password grant | Disabled or rejected. |
| Device flow | Disabled or rejected. |
| Dynamic client registration | Disabled for MVP. |
| PKCE | Required, `S256` only. |
| Redirect URIs | Exact registered URI matching only. |
| Refresh tokens | Opaque, hashed, rotated, auditable. |
| Claims | Identity facts only; no app permissions. |

If Better Auth supports a broader OAuth capability by default, Internal ID must
configure it off, wrap it, or add explicit guard middleware. A feature being
available in Better Auth does not make it part of Internal ID.

Internal ID should add conformance tests around every disabled capability so
that framework upgrades cannot silently widen the provider.

### 3.5 Hostnames

Recommended:

```text
auth.company.com
```

All provider-owned browser authentication should happen on this domain.

Client applications should have their own domains:

```text
dashboard.company.com
admin.company.com
tools.company.com
```

Provider cookies should not be scoped so broadly that every internal application
automatically receives them.

---

## 4. Domain Model

### 4.1 User

A user is the canonical record for a human identity.

Recommended fields:

| Field | Description |
| --- | --- |
| `id` | Stable internal user identifier. |
| `email` | Primary email address. |
| `email_verified_at` | Timestamp when the email was verified. |
| `username` | Optional human-friendly username. |
| `display_name` | Name shown in UI. |
| `given_name` | First or given name. |
| `family_name` | Last or family name. |
| `status` | Lifecycle state. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |
| `deactivated_at` | Timestamp for deactivation, if any. |

Recommended user statuses:

| Status | Meaning |
| --- | --- |
| `pending` | User exists but cannot authenticate yet. |
| `active` | User can authenticate. |
| `suspended` | User is temporarily blocked. |
| `deactivated` | User is no longer active but retained for audit/history. |

### 4.2 Credential

A credential represents a way to authenticate a user.

For the initial system, password credentials are enough.

Recommended fields:

| Field | Description |
| --- | --- |
| `id` | Credential identifier. |
| `user_id` | Owning user. |
| `type` | Credential type, initially `password`. |
| `password_hash` | Argon2id hash. |
| `password_set_at` | Timestamp of last password update. |
| `must_change_password` | Forces password update after next login. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

Password hashes must use a modern password hashing algorithm such as Argon2id.

Never store:

- Plaintext passwords.
- Reversible password encryption.
- Password hints.
- Security questions as secrets.

### 4.3 Group

Groups are identity facts. They are not fine-grained app permissions.

Examples:

- `engineering`.
- `finance`.
- `people`.
- `security`.
- `contractors`.

Groups may be emitted as claims if allowed by the client claim policy.

Recommended fields:

| Field | Description |
| --- | --- |
| `id` | Group identifier. |
| `slug` | Stable machine-readable name. |
| `display_name` | Human-readable name. |
| `description` | Optional description. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### 4.4 Group Membership

Group memberships associate users with groups.

Recommended fields:

| Field | Description |
| --- | --- |
| `user_id` | User identifier. |
| `group_id` | Group identifier. |
| `created_at` | Membership creation timestamp. |
| `created_by` | Admin or system actor that created the membership. |

### 4.5 Client

A client represents an approved internal application.

Examples:

- `dashboard`.
- `admin-console`.
- `incident-tools`.
- `analytics`.

Recommended fields:

| Field | Description |
| --- | --- |
| `id` | Internal row identifier. |
| `client_id` | Public OIDC client identifier. |
| `client_secret_hash` | Hash of client secret, for confidential clients only. |
| `name` | Human-readable app name. |
| `type` | `public` or `confidential`. |
| `status` | `active`, `disabled`, or `deleted`. |
| `allowed_scopes` | Scopes this client may request. |
| `require_pkce` | Whether PKCE is required. |
| `allow_refresh_tokens` | Whether refresh tokens can be issued. |
| `access_token_ttl_seconds` | Access token lifetime. |
| `id_token_ttl_seconds` | ID token lifetime. |
| `refresh_token_idle_ttl_seconds` | Sliding inactivity window. |
| `refresh_token_absolute_ttl_seconds` | Hard maximum refresh lifetime. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### 4.6 Redirect URI

Redirect URIs must be registered and matched exactly.

Recommended fields:

| Field | Description |
| --- | --- |
| `id` | Redirect URI row identifier. |
| `client_id` | Owning client. |
| `uri` | Exact redirect URI. |
| `created_at` | Creation timestamp. |

Rules:

- No wildcard redirect URIs.
- No partial matching.
- No prefix matching.
- No unregistered redirect targets.
- HTTPS required outside local development.

### 4.7 Authorization Code

Authorization codes are short-lived, one-time-use credentials created after a
successful authorization request.

Recommended fields:

| Field | Description |
| --- | --- |
| `code_hash` | Hash of the authorization code. |
| `client_id` | Client that requested the code. |
| `user_id` | Authenticated user. |
| `redirect_uri` | Redirect URI used in the request. |
| `scope` | Approved scope string. |
| `code_challenge` | PKCE code challenge. |
| `code_challenge_method` | Must be `S256`. |
| `nonce` | OIDC nonce, if provided. |
| `auth_time` | Time user authenticated. |
| `expires_at` | Expiration timestamp. |
| `consumed_at` | Timestamp when code was used. |

The raw authorization code should not be stored. Store only a hash.

### 4.8 Refresh Token

Refresh tokens are opaque bearer secrets. Store only a token hash server-side.

Recommended fields:

| Field | Description |
| --- | --- |
| `id` | Refresh token record identifier. |
| `token_hash` | Hash of the opaque refresh token. |
| `user_id` | Owning user. |
| `client_id` | Owning client. |
| `session_id` | Provider session or login session association. |
| `parent_token_id` | Previous token in rotation chain, if any. |
| `rotated_to_token_id` | Next token issued from this token, if any. |
| `issued_at` | Issuance timestamp. |
| `last_used_at` | Last successful use timestamp. |
| `idle_expires_at` | Sliding expiration timestamp. |
| `absolute_expires_at` | Hard expiration timestamp. |
| `revoked_at` | Revocation timestamp, if any. |
| `revocation_reason` | Reason for revocation. |

The response may contain:

```json
{
  "refresh_token": "rt_v1_7Jx9sZC6VY8bP0G9R2Lw3nQ4..."
}
```

The database should contain only a hash of that token.

### 4.9 Provider Session

A provider session represents the user's SSO login with Internal ID.

Recommended fields:

| Field | Description |
| --- | --- |
| `id` | Session identifier. |
| `user_id` | Authenticated user. |
| `session_hash` | Hash of browser session secret. |
| `created_at` | Creation timestamp. |
| `last_seen_at` | Last activity timestamp. |
| `idle_expires_at` | Idle session expiration. |
| `absolute_expires_at` | Hard session expiration. |
| `revoked_at` | Revocation timestamp, if any. |
| `ip_address` | Optional last known IP. |
| `user_agent` | Optional last known user agent. |

The browser cookie should contain a random session secret, not the database row
ID directly.

---

## 5. OIDC Protocol Surface

### 5.1 Supported Endpoints

Required:

| Endpoint | Purpose |
| --- | --- |
| `GET /.well-known/openid-configuration` | OIDC discovery metadata. |
| `GET /oauth/authorize` | Starts the authorization flow. |
| `POST /oauth/token` | Exchanges authorization codes and refresh tokens. |
| `GET /.well-known/jwks.json` | Publishes public signing keys. |
| `GET /oauth/userinfo` | Returns claims for a valid access token. |
| `POST /oauth/revoke` | Revokes refresh tokens. |
| `GET /oauth/logout` | Clears provider session and redirects user. |

Optional but useful:

| Endpoint | Purpose |
| --- | --- |
| `GET /login` | Provider login form. |
| `POST /login` | Provider login submission. |
| `POST /logout` | First-party provider logout action. |
| `GET /admin` | Admin UI entrypoint. |
| `/admin/api/*` | Provider-local admin JSON API for the future standalone admin UI. |

### 5.2 Supported Response Types

Supported:

```text
code
```

Unsupported:

```text
token
id_token
code token
code id_token
id_token token
code id_token token
```

Implicit and hybrid flows are not supported.

### 5.3 Supported Grant Types

Supported:

```text
authorization_code
refresh_token
```

Unsupported:

```text
password
client_credentials
urn:ietf:params:oauth:grant-type:device_code
jwt-bearer
token-exchange
```

### 5.4 Supported Code Challenge Methods

Supported:

```text
S256
```

Unsupported:

```text
plain
```

### 5.5 Supported Scopes

Initial scopes:

| Scope | Meaning |
| --- | --- |
| `openid` | Required for OIDC. |
| `profile` | Allows profile claims such as name and username. |
| `email` | Allows email claims. |
| `groups` | Allows group membership claims, if client policy permits. |
| `offline_access` | Requests refresh token issuance, if client policy permits. |

The `openid` scope is required for OIDC login.

The `offline_access` scope should not automatically produce a refresh token. The
client must also be configured with `allow_refresh_tokens=true`.

---

## 6. Claims Strategy

### 6.1 Claims Are Identity Facts

Claims should describe stable identity facts.

Recommended claims:

| Claim | Description |
| --- | --- |
| `iss` | Issuer URL. |
| `sub` | Stable subject identifier. |
| `aud` | Intended audience. |
| `exp` | Expiration timestamp. |
| `iat` | Issued-at timestamp. |
| `auth_time` | Time user authenticated. |
| `nonce` | Request nonce, if supplied. |
| `email` | User email. |
| `email_verified` | Whether email is verified. |
| `name` | Display name. |
| `given_name` | Given name. |
| `family_name` | Family name. |
| `preferred_username` | Username. |
| `groups` | Group slugs, if permitted. |
| `profile_type` | Internal classification such as `employee` or `contractor`. |

Avoid claims that represent client-specific authorization.

### 6.2 Subject Identifier

The `sub` claim must be:

- Stable.
- Unique within the issuer.
- Non-reassignable.
- Not an email address.

Recommended:

```json
{
  "sub": "usr_01JQ4ZV7K9R8T2W6N5M3P0A1BC"
}
```

Do not use:

```json
{
  "sub": "ana@company.com"
}
```

Emails can change. Subject identifiers must not.

### 6.3 ID Token Example

```json
{
  "iss": "https://auth.company.com",
  "sub": "usr_01JQ4ZV7K9R8T2W6N5M3P0A1BC",
  "aud": "client_dashboard",
  "exp": 1781108100,
  "iat": 1781107200,
  "auth_time": 1781107152,
  "nonce": "n-0S6_WzA2Mj",
  "email": "ana@company.com",
  "email_verified": true,
  "name": "Ana Francis",
  "given_name": "Ana",
  "family_name": "Francis",
  "preferred_username": "ana",
  "groups": ["engineering"],
  "profile_type": "employee"
}
```

### 6.4 Access Token Strategy

Access tokens are used by client applications to call provider-owned resources,
especially `/oauth/userinfo`.

Access tokens may be JWTs if internal services need local verification.

For this platform, the access token should contain only the claims needed to
validate the token and identify the subject.

Example:

```json
{
  "iss": "https://auth.company.com",
  "sub": "usr_01JQ4ZV7K9R8T2W6N5M3P0A1BC",
  "aud": "https://auth.company.com/oauth/userinfo",
  "client_id": "client_dashboard",
  "scope": "openid profile email groups",
  "exp": 1781108100,
  "iat": 1781107200,
  "jti": "atk_01JQ4ZXKE9X7M6D2S8Q1P3C4BN"
}
```

Client applications should not treat provider access tokens as local app session
tokens unless that is an intentional app architecture decision.

Many web applications should exchange the provider login for their own local
application session.

### 6.5 Claim Release Policy

Each client should have a claim release policy.

Example:

| Client | Allowed Claims |
| --- | --- |
| `client_dashboard` | `sub`, `email`, `name`, `groups` |
| `client_analytics` | `sub`, `email`, `name` |
| `client_hr` | `sub`, `email`, `name`, `profile_type`, `groups` |

This allows Internal ID to avoid over-sharing identity data.

---

## 7. Client Application Model

### 7.1 Client Types

Internal ID should model at least two client types.

| Type | Description | Secret Allowed |
| --- | --- | --- |
| `confidential` | Backend app that can keep a secret safely. | Yes |
| `public` | SPA, mobile app, desktop app, or any app that cannot protect a secret. | No |

Even if the initial use case is unknown, modeling this distinction early prevents
dangerous client configurations later.

### 7.2 Confidential Clients

Confidential clients:

- Have a server-side backend.
- Can store a client secret.
- May authenticate to the token endpoint.
- Should still use PKCE where possible.

Examples:

- Server-rendered internal dashboard.
- Backend-for-frontend application.
- Traditional MVC application.

### 7.3 Public Clients

Public clients:

- Cannot keep a secret.
- Must use PKCE.
- Must not be issued a client secret.
- Should avoid long-lived browser storage of tokens.

Examples:

- Browser SPA.
- Native desktop app.
- Mobile app.

### 7.4 Client Registration Rules

Only admins can register clients.

Registration must define:

- Client name.
- Client type.
- Redirect URIs.
- Post-logout redirect URIs.
- Allowed scopes.
- Claim release policy.
- Whether refresh tokens are allowed.
- Token TTLs.
- Whether PKCE is required.
- Client owner or owning team.

### 7.5 Redirect URI Validation

Redirect URI validation must use exact string matching against registered URIs.

Allowed:

```text
https://dashboard.company.com/oauth/callback
```

Rejected:

```text
https://dashboard.company.com/oauth/callback/
https://dashboard.company.com/oauth/*
https://dashboard.company.com
https://evil.example.com/oauth/callback
```

### 7.6 Local Development Redirects

For local development, allow explicit localhost URIs only when registered:

```text
http://localhost:3000/oauth/callback
http://127.0.0.1:3000/oauth/callback
```

Never allow wildcard localhost ports in production configuration.

---

## 8. Authentication Model

### 8.1 Login Identifier

Initial login should support email.

Optional later:

- Username.
- Employee ID.

Login identifiers must be normalized carefully:

- Emails should be lowercased for lookup.
- Preserve original casing for display if desired.
- Enforce uniqueness on normalized email.

### 8.2 Password Verification

Passwords must be hashed using Argon2id.

Requirements:

- Use per-password salts.
- Use strong memory and time cost parameters.
- Rehash passwords when parameters are upgraded.
- Never log passwords.
- Never include passwords in traces.
- Never return different error messages for unknown email vs wrong password.

Generic login error:

```text
Invalid email or password.
```

### 8.3 Account State Checks

Authentication must check user state.

Rules:

- `pending` users cannot authenticate unless completing an invite or activation flow.
- `active` users can authenticate.
- `suspended` users cannot authenticate.
- `deactivated` users cannot authenticate.

### 8.4 Login Rate Limiting

Apply rate limits by:

- Account identifier.
- Source IP.
- Session or browser fingerprint where appropriate.

Rate limits should slow attackers without making user enumeration easy.

### 8.5 Reauthentication

Some actions should require recent authentication:

- Changing password.
- Changing email.
- Creating a client.
- Rotating a client secret.
- Disabling a user.
- Revoking all sessions.

The provider should track `auth_time` in the session and ID token.

### 8.6 MFA Hooks

MFA is not required in the first version unless product requirements demand it.

However, the authentication domain should leave a clean hook for future MFA.

Possible future methods:

- TOTP.
- WebAuthn/passkeys.
- Backup codes.

Do not design the system in a way that makes MFA difficult to add later.

---

## 9. Session Model

### 9.1 Provider SSO Session

The provider session is a login session scoped to Internal ID.

It is stored in a secure browser cookie on the provider domain:

```text
auth.company.com
```

Cookie requirements:

- `HttpOnly`.
- `Secure`.
- `SameSite=Lax` for standard redirect-based OIDC flows.
- Random high-entropy value.
- No user data inside the cookie.
- No JWT session cookie for the provider session.

Example:

```http
Set-Cookie: internal_id_session=sess_v1_random_secret; Path=/; HttpOnly; Secure; SameSite=Lax
```

### 9.2 Session Storage

Provider session records may be stored in:

- SQL, for durability.
- Redis with persistence and replication, for high-throughput TTL session state.

For the initial system, SQL-backed sessions are simpler and easier to audit.

If Redis is used, the system must define what happens when Redis loses session
state. Users may be logged out, but security must not be weakened.

### 9.3 Session Expiration

Recommended session windows:

| Session Type | Suggested Lifetime |
| --- | --- |
| Idle session expiration | 8 to 24 hours |
| Absolute session expiration | 7 to 30 days |
| Recent authentication window | 5 to 15 minutes |

Exact values should be set by internal security policy.

### 9.4 Session Revocation

Admins should be able to revoke:

- One session.
- All sessions for a user.
- All sessions associated with a suspicious event.

Users should be able to view and revoke their own sessions later if self-service
account management is added.

---

## 10. Token Model

### 10.1 Token Types

Internal ID uses:

| Token | Format | Purpose |
| --- | --- | --- |
| Authorization code | Opaque | Short-lived one-time code exchanged for tokens. |
| ID token | JWT | Proves authentication and carries identity claims. |
| Access token | JWT or opaque | Allows access to provider resources such as `/userinfo`. |
| Refresh token | Opaque | Allows a client to obtain new tokens without user interaction. |

Recommended:

- ID tokens: JWT.
- Access tokens: JWT for local verification, or opaque if all validation goes through the provider.
- Refresh tokens: opaque only.
- Authorization codes: opaque only.

### 10.2 ID Tokens

ID tokens are for the client application.

They prove:

- The user authenticated.
- The issuer is Internal ID.
- The token was issued for a specific client.
- The token has not expired.
- The claims were signed by Internal ID.

ID token validation by clients must check:

- Signature.
- `iss`.
- `aud`.
- `exp`.
- `iat`.
- `nonce`, when provided.
- `auth_time`, when relevant.

### 10.3 Access Tokens

Access tokens should be short-lived.

Recommended default:

```text
15 minutes
```

Access tokens are bearer tokens. Whoever has the token can use it until it
expires, unless the system uses introspection or revocation lists.

For a simple internal OIDC provider, short lifetimes are the primary mitigation.

### 10.4 Refresh Tokens

Refresh tokens should be:

- Opaque.
- High entropy.
- Stored only as hashes.
- Rotated on every use.
- Bound to a user.
- Bound to a client.
- Bound to a session where possible.
- Revocable.
- Audited.

Refresh tokens should not be JWTs.

### 10.5 Token Lifetimes

Suggested defaults:

| Token | Lifetime |
| --- | --- |
| Authorization code | 1 to 5 minutes |
| ID token | 5 to 15 minutes |
| Access token | 5 to 15 minutes |
| Refresh token idle window | 8 to 24 hours |
| Refresh token absolute lifetime | 7 to 30 days |

For the MVP:

```text
Authorization code: 5 minutes
ID token: 15 minutes
Access token: 15 minutes
Refresh token idle expiration: 24 hours
Refresh token absolute expiration: 7 days
```

---

## 11. Refresh Token Rotation

### 11.1 Why Rotation Exists

Refresh tokens are powerful. If stolen, they can be used to mint new tokens.

Rotation reduces the impact of theft by making each refresh token one-time-use.

### 11.2 Normal Rotation

When a valid refresh token is used:

1. The provider hashes the submitted token.
2. The provider finds the matching refresh token row.
3. The provider verifies the token is active.
4. The provider revokes the current token.
5. The provider creates a new refresh token.
6. The provider links the old token to the new token.
7. The provider returns a new access token and new refresh token.

Example:

| Token | State | Rotated To |
| --- | --- | --- |
| `rt_01` | revoked | `rt_02` |
| `rt_02` | active | null |

### 11.3 Replay Detection

If a refresh token is used after it has already been rotated, that is suspicious.

Example:

```text
Token A was used successfully and rotated to Token B.
Token A is used again later.
```

This may mean:

- A client retried a request incorrectly.
- A network race occurred.
- A token was stolen.

The provider should treat this as a security event.

Recommended response:

1. Revoke the entire refresh token family.
2. Revoke associated app sessions where possible.
3. Optionally revoke the provider session.
4. Require the user to log in again.
5. Emit a high-severity audit event.

### 11.4 Rotation Family

Refresh tokens should be linked as a family.

```text
rt_01 -> rt_02 -> rt_03 -> rt_04
```

If replay is detected at any point, revoke the family:

```text
rt_01 revoked
rt_02 revoked
rt_03 revoked
rt_04 revoked
```

### 11.5 Race Handling

Refresh rotation can experience legitimate races.

Example:

- A backend sends a refresh request.
- The request succeeds but the response is lost.
- The backend retries with the same old token.

Possible strategies:

1. Strict replay detection.
2. Small grace window for identical retry detection.
3. Idempotency key for refresh requests.

For security simplicity, start strict unless client behavior makes this painful.

If a grace window is added, it must be short and carefully audited.

---

## 12. Cryptography and JWKS

### 12.1 Signing Algorithm

Use asymmetric signing keys for JWTs.

Recommended algorithms:

- `RS256`, widely supported.
- `ES256`, smaller signatures but more operational nuance.

For broad compatibility, start with:

```text
RS256
```

### 12.2 Key Material

Private keys must:

- Never be exposed through logs.
- Never be returned from APIs.
- Never be committed to source control.
- Be encrypted at rest.
- Be accessible only to the token signing path and key rotation process.

Public keys are published through JWKS.

### 12.3 JWKS Endpoint

The JWKS endpoint publishes active public keys:

```http
GET /.well-known/jwks.json
```

Example:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "key_2026_06_10_v1",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

### 12.4 Key IDs

Every signed JWT must include a `kid` header:

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key_2026_06_10_v1"
}
```

Verifiers use `kid` to select the correct public key.

### 12.5 Zero-Downtime Key Rotation

Rotation sequence:

1. Generate a new key pair.
2. Store the new private key securely.
3. Publish the new public key in JWKS while keeping the old public key.
4. Start signing new tokens with the new private key.
5. Keep the old public key available until all old tokens expire.
6. Remove the old public key from JWKS after the maximum token lifetime plus cache buffer.
7. Mark the old private key retired.

Example:

```text
T0:
  JWKS publishes key_A.
  Tokens signed with key_A.

T1:
  JWKS publishes key_A and key_B.
  Tokens signed with key_B.

T2:
  Old key_A tokens have expired.
  JWKS publishes only key_B.
```

### 12.6 Emergency Key Rotation

If a signing private key is suspected to be compromised:

1. Immediately stop signing with the compromised key.
2. Generate and activate a new key.
3. Remove the compromised public key from JWKS.
4. Revoke affected sessions or refresh token families where appropriate.
5. Force reauthentication if needed.
6. Emit critical audit and incident events.
7. Notify owners of affected internal apps.

This may break tokens signed with the old key before natural expiration, but
security takes priority.

---

## 13. Authorization Code + PKCE Flow

This is the preferred flow for public clients and browser-based applications.

It is also safe for confidential clients and should be used broadly unless there
is a strong reason not to.

### 13.1 Actors

```text
User Browser
Client Application
Internal ID Provider
```

### 13.2 High-Level Flow

```text
1. User opens client app.
2. Client app creates a PKCE verifier and challenge.
3. Client app redirects browser to Internal ID /oauth/authorize.
4. Internal ID authenticates the user or reuses an existing provider session.
5. Internal ID validates request parameters.
6. Internal ID creates an authorization code.
7. Internal ID redirects browser back to client redirect URI with code and state.
8. Client exchanges code and PKCE verifier for tokens.
9. Client validates ID token.
10. Client establishes its own local app session if applicable.
```

### 13.3 PKCE Generation

The client generates:

```text
code_verifier = high_entropy_random_string
code_challenge = BASE64URL(SHA256(code_verifier))
```

The client sends:

```text
code_challenge
code_challenge_method=S256
```

The client later proves possession by sending:

```text
code_verifier
```

### 13.4 Authorization Request

```http
GET /oauth/authorize?
  response_type=code
  &client_id=client_dashboard
  &redirect_uri=https%3A%2F%2Fdashboard.company.com%2Foauth%2Fcallback
  &scope=openid%20profile%20email%20groups
  &state=st_01JQ55V3R87W6R1Y6GZK8KVQHQ
  &nonce=n_01JQ55V8X3JZ0E4HRV83KEP3TA
  &code_challenge=E9Melhoa2OwvFrGMTJguCH5K140Wq37x4bK79CzK_6k
  &code_challenge_method=S256 HTTP/1.1
Host: auth.company.com
```

Required validation:

- `response_type` must be `code`.
- `client_id` must identify an active client.
- `redirect_uri` must exactly match a registered URI.
- `scope` must include `openid`.
- Requested scopes must be allowed for the client.
- `state` must be present.
- `code_challenge` must be present if client requires PKCE.
- `code_challenge_method` must be `S256`.

Recommended:

- Require PKCE for all clients.
- Require `state`.
- Require `nonce` for browser clients.

### 13.5 Provider Authentication

If the browser has no valid provider session:

1. Show login form.
2. Validate credentials.
3. Create provider session.
4. Continue authorization flow.

If the browser already has a valid provider session:

1. Skip login.
2. Continue authorization flow.

### 13.6 Authorization Response

```http
HTTP/1.1 302 Found
Location: https://dashboard.company.com/oauth/callback?code=ac_v1_B7T...&state=st_01JQ55V3R87W6R1Y6GZK8KVQHQ
```

The authorization code:

- Must be high entropy.
- Must be one-time-use.
- Must expire quickly.
- Must be stored only as a hash.
- Must be bound to the client.
- Must be bound to the redirect URI.
- Must be bound to the PKCE challenge.

### 13.7 Token Exchange

```http
POST /oauth/token HTTP/1.1
Host: auth.company.com
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=ac_v1_B7T...
&redirect_uri=https%3A%2F%2Fdashboard.company.com%2Foauth%2Fcallback
&client_id=client_dashboard
&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

For confidential clients, include client authentication:

```http
Authorization: Basic base64(client_id:client_secret)
```

or a supported client authentication method.

### 13.8 Token Exchange Validation

The provider must validate:

- Grant type is `authorization_code`.
- Code exists by hash.
- Code has not expired.
- Code has not already been consumed.
- Client matches the code.
- Redirect URI matches the original authorization request.
- PKCE verifier matches the stored challenge.
- Client secret is valid for confidential clients.
- User still exists and is active.
- Client is still active.

If valid:

1. Mark authorization code consumed.
2. Issue ID token.
3. Issue access token.
4. Issue refresh token only if requested and allowed.
5. Emit audit event.

### 13.9 Token Response

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleV8yMDI2XzA2XzEwX3YxIn0...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "rt_v1_c9ZnZl93aXRoX2hpZ2hfZW50cm9weQ...",
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleV8yMDI2XzA2XzEwX3YxIn0..."
}
```

If refresh tokens are not allowed:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleV8yMDI2XzA2XzEwX3YxIn0...",
  "token_type": "Bearer",
  "expires_in": 900,
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleV8yMDI2XzA2XzEwX3YxIn0..."
}
```

---

## 14. Server-Rendered Web App Flow

Server-rendered apps and backend-for-frontend apps can keep tokens away from the
browser almost entirely.

### 14.1 Recommended Flow

```text
1. Browser visits app.
2. App redirects browser to Internal ID.
3. User authenticates at Internal ID.
4. Internal ID redirects browser back to app backend with authorization code.
5. App backend exchanges code for tokens.
6. App backend validates ID token.
7. App backend creates its own local app session cookie.
8. Browser uses local app session cookie with that app.
```

### 14.2 Benefits

- Client secret can be protected.
- Refresh token can remain server-side.
- Browser does not need direct access to provider tokens.
- The app can maintain its own local session.
- Logout behavior is easier to reason about.

### 14.3 App Session Cookie

The app should set its own cookie:

```http
Set-Cookie: app_session=app_sess_random_secret; Path=/; HttpOnly; Secure; SameSite=Lax
```

The app session is separate from the provider session.

```text
Provider session:
  auth.company.com

App session:
  dashboard.company.com
```

### 14.4 Token Storage

For server-rendered apps:

- ID token may be validated and discarded.
- Access token may be stored server-side if the app needs `/userinfo`.
- Refresh token must be stored server-side if issued.
- Browser should use only the app's own session cookie.

---

## 15. Logout and Revocation

### 15.1 Logout Is Multi-Layered

There are two separate sessions:

1. Provider SSO session.
2. Client application session.

Logging out of one does not automatically clear the other unless the app
coordinates the flow.

### 15.2 Local App Logout

Client app should:

1. Clear its local app session.
2. Revoke stored refresh token, if any.
3. Optionally redirect to provider logout.

### 15.3 Refresh Token Revocation

```http
POST /oauth/revoke HTTP/1.1
Host: auth.company.com
Content-Type: application/x-www-form-urlencoded

token=rt_v1_c9ZnZl93aXRoX2hpZ2hfZW50cm9weQ...
&token_type_hint=refresh_token
&client_id=client_dashboard
```

Confidential clients must authenticate when revoking tokens.

Revocation should:

- Hash the submitted token.
- Find the token row.
- Verify the client owns the token.
- Mark the token revoked.
- Optionally revoke the token family.
- Emit audit event.

### 15.4 Provider Logout

```http
GET /oauth/logout?
  client_id=client_dashboard
  &post_logout_redirect_uri=https%3A%2F%2Fdashboard.company.com%2Fgoodbye
  &state=logout_st_01JQ57KFYSH4TX81FH4E8PM8DC HTTP/1.1
Host: auth.company.com
Cookie: internal_id_session=sess_v1_random_secret
```

Provider response:

```http
HTTP/1.1 302 Found
Set-Cookie: internal_id_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax
Location: https://dashboard.company.com/goodbye?state=logout_st_01JQ57KFYSH4TX81FH4E8PM8DC
```

The `post_logout_redirect_uri` must be registered for the client.

### 15.5 Global Logout

Global logout means:

- Clear the provider session.
- Revoke refresh tokens tied to that session.
- Emit logout event.

It does not guarantee every client app immediately clears every local app session
unless the platform later implements back-channel logout or front-channel logout.

For MVP, document this limitation clearly for client app owners.

---

## 16. Storage Boundaries

### 16.1 Durable PostgreSQL State

Store in PostgreSQL:

- Users.
- Credentials.
- Groups.
- Group memberships.
- Clients.
- Redirect URIs.
- Client secrets.
- Refresh tokens.
- Signing key metadata.
- Provider sessions, if using durable sessions.
- Audit events, or audit event metadata.

PostgreSQL is appropriate where:

- Referential integrity matters.
- Auditing matters.
- State must survive restarts.
- Operators need reliable queries.
- Transactions and row-level locking protect protocol invariants.

### 16.2 Ephemeral TTL State

Store in Redis or equivalent:

- Short-lived authorization codes, if not stored in SQL.
- Login CSRF state.
- Password reset temporary state, if added.
- Rate limit counters.

Ephemeral state is appropriate where:

- Data is short-lived.
- TTL expiration is natural.
- Loss causes retry or re-login, not security failure.

### 16.3 Recommended MVP Storage Choice

For simplicity:

- Use PostgreSQL for durable state.
- Use PostgreSQL or Redis for authorization codes.
- Use PostgreSQL for sessions at first.
- Use Redis later for rate limiting and high-volume TTL state.

The first version should optimize for correctness and auditability over maximum
throughput.

### 16.4 TypeORM Persistence Rules

TypeORM is the persistence implementation for the NestJS application.

Rules:

- Migrations are the source of truth for production schema changes.
- Entity decorators should match committed migrations.
- `synchronize` must be disabled in production.
- Security-sensitive state changes must happen inside database transactions.
- Token and code lookup columns must have supporting indexes.
- Unique constraints should enforce non-reassignable identifiers and exact
  client URI registrations.
- Raw SQL is allowed for complex locking or atomic update behavior, but should
  be isolated and tested.

Refresh token rotation and authorization code consumption should use atomic
database behavior. The implementation must prevent two concurrent requests from
successfully consuming the same code or refresh token.

### 16.5 PostgreSQL Implementation Rules

PostgreSQL is the production database for Internal ID.

Recommended PostgreSQL posture:

- Use `TIMESTAMPTZ` for timestamps.
- Use `TEXT` for externally stable identifiers unless UUIDs are chosen
  consistently across the system.
- Use `JSONB` for structured metadata such as audit metadata and private client
  metadata, while keeping query-critical fields as first-class columns.
- Use unique constraints for normalized emails, client IDs, redirect URI
  registrations, token hashes, code hashes, signing key IDs, and session hashes.
- Use partial indexes where useful for active sessions, active refresh tokens,
  unconsumed authorization codes, and non-retired signing keys.
- Use transactions with row locks for one-time-use state transitions.
- Use `ON DELETE` behavior deliberately; identity and audit records should not
  disappear accidentally through cascading deletes.
- Use connection pooling appropriate for NestJS deployment size.

Security-sensitive flows should rely on PostgreSQL atomicity:

- Authorization code consumption should update exactly one unconsumed,
  unexpired row.
- Refresh token rotation should lock the current token row before revoking it
  and creating the next token.
- User deactivation should revoke sessions and refresh tokens in the same
  transaction where practical.
- Client disabling should prevent new authorization and token exchange
  immediately after commit.

---

## 17. Database Schema Blueprint

This section is the conceptual schema blueprint. The implementation should
translate it into TypeORM entities and PostgreSQL migrations.

The SQL examples use generic `TIMESTAMP` for readability. In PostgreSQL
migrations, prefer `TIMESTAMPTZ` for stored event, session, token, and audit
timestamps.

### 17.1 users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL UNIQUE,
  email_verified_at TIMESTAMP NULL,
  username TEXT NULL,
  normalized_username TEXT NULL UNIQUE,
  display_name TEXT NOT NULL,
  given_name TEXT NULL,
  family_name TEXT NULL,
  profile_type TEXT NOT NULL DEFAULT 'employee',
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  deactivated_at TIMESTAMP NULL
);
```

### 17.2 credentials

```sql
CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  password_hash TEXT NULL,
  password_set_at TIMESTAMP NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### 17.3 groups

```sql
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### 17.4 group_memberships

```sql
CREATE TABLE group_memberships (
  user_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  created_at TIMESTAMP NOT NULL,
  created_by TEXT NULL REFERENCES users(id),
  PRIMARY KEY (user_id, group_id)
);
```

### 17.5 oidc_clients

```sql
CREATE TABLE oidc_clients (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  allowed_scopes TEXT NOT NULL,
  allowed_claims TEXT NOT NULL,
  require_pkce BOOLEAN NOT NULL DEFAULT TRUE,
  allow_refresh_tokens BOOLEAN NOT NULL DEFAULT FALSE,
  access_token_ttl_seconds INTEGER NOT NULL DEFAULT 900,
  id_token_ttl_seconds INTEGER NOT NULL DEFAULT 900,
  refresh_token_idle_ttl_seconds INTEGER NULL,
  refresh_token_absolute_ttl_seconds INTEGER NULL,
  owner_team TEXT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### 17.6 oidc_redirect_uris

```sql
CREATE TABLE oidc_redirect_uris (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oidc_clients(id),
  uri TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  UNIQUE (client_id, uri)
);
```

### 17.7 oidc_post_logout_redirect_uris

```sql
CREATE TABLE oidc_post_logout_redirect_uris (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oidc_clients(id),
  uri TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  UNIQUE (client_id, uri)
);
```

### 17.8 provider_sessions

```sql
CREATE TABLE provider_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  session_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL,
  last_seen_at TIMESTAMP NOT NULL,
  auth_time TIMESTAMP NOT NULL,
  idle_expires_at TIMESTAMP NOT NULL,
  absolute_expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  revocation_reason TEXT NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL
);
```

### 17.9 authorization_codes

```sql
CREATE TABLE authorization_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES oidc_clients(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  provider_session_id TEXT NOT NULL REFERENCES provider_sessions(id),
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL,
  nonce TEXT NULL,
  auth_time TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP NULL
);
```

### 17.10 refresh_tokens

```sql
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  client_id TEXT NOT NULL REFERENCES oidc_clients(id),
  provider_session_id TEXT NULL REFERENCES provider_sessions(id),
  parent_token_id TEXT NULL REFERENCES refresh_tokens(id),
  rotated_to_token_id TEXT NULL REFERENCES refresh_tokens(id),
  family_id TEXT NOT NULL,
  issued_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP NULL,
  idle_expires_at TIMESTAMP NOT NULL,
  absolute_expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  revocation_reason TEXT NULL
);
```

Recommended indexes:

```sql
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_client_id ON refresh_tokens(client_id);
CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(idle_expires_at, absolute_expires_at);
```

### 17.11 signing_keys

```sql
CREATE TABLE signing_keys (
  id TEXT PRIMARY KEY,
  kid TEXT NOT NULL UNIQUE,
  algorithm TEXT NOT NULL,
  public_jwk TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  activated_at TIMESTAMP NULL,
  retired_at TIMESTAMP NULL
);
```

Key statuses:

| Status | Meaning |
| --- | --- |
| `pending` | Created but not signing tokens yet. |
| `active` | Used to sign new tokens. |
| `retiring` | Still published in JWKS but no longer signs new tokens. |
| `retired` | Not used and not published. |
| `compromised` | Removed from normal use due to incident. |

### 17.12 audit_events

```sql
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  actor_user_id TEXT NULL REFERENCES users(id),
  target_user_id TEXT NULL REFERENCES users(id),
  client_id TEXT NULL REFERENCES oidc_clients(id),
  provider_session_id TEXT NULL REFERENCES provider_sessions(id),
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  metadata_json TEXT NULL,
  created_at TIMESTAMP NOT NULL
);
```

---

## 18. HTTP Endpoint Reference

This section describes the public Internal ID contract.

When Better Auth is used underneath, the concrete route paths may be provided by
Better Auth directly, mounted under an auth route, or adapted through thin
Internal ID route wrappers. Regardless of implementation path, clients should see
the endpoint behavior and discovery metadata described here.

### 18.1 Discovery

```http
GET /.well-known/openid-configuration HTTP/1.1
Host: auth.company.com
```

Response:

```json
{
  "issuer": "https://auth.company.com",
  "authorization_endpoint": "https://auth.company.com/oauth/authorize",
  "token_endpoint": "https://auth.company.com/oauth/token",
  "userinfo_endpoint": "https://auth.company.com/oauth/userinfo",
  "jwks_uri": "https://auth.company.com/.well-known/jwks.json",
  "revocation_endpoint": "https://auth.company.com/oauth/revoke",
  "end_session_endpoint": "https://auth.company.com/oauth/logout",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": ["openid", "profile", "email", "groups", "offline_access"],
  "claims_supported": [
    "sub",
    "iss",
    "aud",
    "exp",
    "iat",
    "auth_time",
    "nonce",
    "email",
    "email_verified",
    "name",
    "given_name",
    "family_name",
    "preferred_username",
    "groups",
    "profile_type"
  ],
  "code_challenge_methods_supported": ["S256"]
}
```

### 18.2 Authorization Endpoint

```http
GET /oauth/authorize HTTP/1.1
Host: auth.company.com
```

Query parameters:

| Parameter | Required | Description |
| --- | --- | --- |
| `response_type` | Yes | Must be `code`. |
| `client_id` | Yes | Registered client identifier. |
| `redirect_uri` | Yes | Exact registered redirect URI. |
| `scope` | Yes | Must include `openid`. |
| `state` | Yes | Client CSRF protection value. |
| `nonce` | Recommended | Bound into ID token. |
| `code_challenge` | Yes | PKCE challenge. |
| `code_challenge_method` | Yes | Must be `S256`. |
| `prompt` | Optional | Optional OIDC prompt behavior. |
| `max_age` | Optional | Maximum allowed time since authentication. |

Supported `prompt` values:

| Value | Behavior |
| --- | --- |
| `login` | Force reauthentication. |
| `none` | Do not show UI; fail if user is not already authenticated. |

The platform does not need to support consent prompts for the MVP because clients
are admin-approved internal apps.

### 18.3 Token Endpoint

```http
POST /oauth/token HTTP/1.1
Host: auth.company.com
Content-Type: application/x-www-form-urlencoded
```

Supported authorization code request:

```text
grant_type=authorization_code
code=ac_v1_...
redirect_uri=https%3A%2F%2Fdashboard.company.com%2Foauth%2Fcallback
client_id=client_dashboard
code_verifier=...
```

Supported refresh request:

```text
grant_type=refresh_token
refresh_token=rt_v1_...
client_id=client_dashboard
```

Token endpoint error example:

```json
{
  "error": "invalid_grant",
  "error_description": "The authorization grant is invalid."
}
```

Do not include sensitive internal details in OAuth error responses.

### 18.4 UserInfo Endpoint

```http
GET /oauth/userinfo HTTP/1.1
Host: auth.company.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

Response:

```json
{
  "sub": "usr_01JQ4ZV7K9R8T2W6N5M3P0A1BC",
  "email": "ana@company.com",
  "email_verified": true,
  "name": "Ana Francis",
  "given_name": "Ana",
  "family_name": "Francis",
  "preferred_username": "ana",
  "groups": ["engineering"],
  "profile_type": "employee"
}
```

The returned claims must respect:

- Requested scopes.
- Client claim release policy.
- Current user status.

### 18.5 JWKS Endpoint

```http
GET /.well-known/jwks.json HTTP/1.1
Host: auth.company.com
```

Response:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "key_2026_06_10_v1",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

### 18.6 Revocation Endpoint

```http
POST /oauth/revoke HTTP/1.1
Host: auth.company.com
Content-Type: application/x-www-form-urlencoded

token=rt_v1_...
&token_type_hint=refresh_token
&client_id=client_dashboard
```

The endpoint should return success even if the token is unknown, to avoid token
probing.

### 18.7 Logout Endpoint

```http
GET /oauth/logout?
  client_id=client_dashboard
  &post_logout_redirect_uri=https%3A%2F%2Fdashboard.company.com%2Fgoodbye
  &state=logout_state_123 HTTP/1.1
Host: auth.company.com
```

The provider should:

1. Validate the client.
2. Validate the post-logout redirect URI.
3. Clear the provider session cookie.
4. Revoke refresh tokens tied to the provider session, if policy says so.
5. Redirect to the post-logout URI.

---

## 19. Security Requirements

### 19.1 Baseline Web Security

Required:

- HTTPS everywhere outside local development.
- Secure cookies.
- HttpOnly cookies.
- CSRF protection on provider forms.
- Strict redirect URI validation.
- No wildcard redirects.
- No open redirects.
- Rate limiting on login and token endpoints.
- Generic login failure messages.
- Passwords hashed with Argon2id.
- Secrets encrypted or hashed at rest as appropriate.
- Structured audit logs for security events.

### 19.2 CSRF

Provider login forms and admin forms require CSRF protection.

OIDC redirects rely on the client's `state` parameter for client-side CSRF
protection. Internal ID must require `state`, but the client is responsible for
validating it after redirect.

### 19.3 XSS

Provider pages must avoid XSS because XSS on the provider domain can compromise
authentication flows.

Requirements:

- Escape user-controlled content.
- Use a strict Content Security Policy.
- Avoid inline scripts where possible.
- Avoid storing sensitive tokens in browser-accessible storage.

### 19.4 Open Redirects

Open redirects are especially dangerous in identity systems.

Rules:

- Redirect only to exact registered URIs.
- Do not accept arbitrary `next` URLs after login.
- If a `return_to` mechanism exists, sign or server-store it.
- Never redirect to a URL solely because it appears in a query parameter.

### 19.5 Token Leakage

Avoid putting tokens in:

- URLs.
- Logs.
- Error tracking breadcrumbs.
- Browser localStorage.
- Analytics tools.
- Referrer headers.

Authorization codes appear in URLs briefly. They must be:

- Short-lived.
- One-time-use.
- Protected by PKCE.

### 19.6 Client Secrets

Client secrets:

- Are only for confidential clients.
- Must be generated by the provider.
- Must be shown only once after creation.
- Must be stored as hashes.
- Must be rotatable.
- Must never be logged.

### 19.7 User Enumeration

Avoid leaking whether an account exists.

Login failure should return:

```text
Invalid email or password.
```

Password reset flows, if added later, should return:

```text
If an account exists, instructions have been sent.
```

### 19.8 Account Deactivation

When a user is deactivated:

1. Revoke provider sessions.
2. Revoke refresh tokens.
3. Prevent new logins.
4. Continue retaining audit history.
5. Keep subject identifiers non-reassignable.

### 19.9 Security Headers

Provider responses should include:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'self'; frame-ancestors 'none'
```

Adjust CSP as required by the chosen frontend implementation.

---

## 20. Audit and Observability

### 20.1 Audit Goals

Audit logging should answer:

- Who logged in?
- Who failed to log in?
- Who changed a user?
- Who registered or changed a client?
- Which client received tokens?
- Which sessions were revoked?
- Was refresh token replay detected?
- Was a signing key rotated?

### 20.2 Audit Event Types

Recommended events:

| Event Type | Severity |
| --- | --- |
| `user.login.succeeded` | info |
| `user.login.failed` | warning |
| `user.logout.succeeded` | info |
| `user.password.changed` | warning |
| `user.created` | info |
| `user.updated` | info |
| `user.suspended` | warning |
| `user.deactivated` | warning |
| `group.created` | info |
| `group.membership.added` | info |
| `group.membership.removed` | info |
| `client.created` | warning |
| `client.updated` | warning |
| `client.secret.rotated` | warning |
| `oidc.authorization_code.issued` | info |
| `oidc.authorization_code.consumed` | info |
| `oidc.token.issued` | info |
| `oidc.refresh_token.rotated` | info |
| `oidc.refresh_token.revoked` | info |
| `oidc.refresh_token.replay_detected` | critical |
| `signing_key.created` | warning |
| `signing_key.activated` | warning |
| `signing_key.retired` | warning |
| `signing_key.compromised` | critical |

### 20.3 Audit Metadata

Include:

- Timestamp.
- Event type.
- Severity.
- Actor user ID.
- Target user ID.
- Client ID.
- Session ID.
- IP address.
- User agent.
- Request ID.
- Result.
- Safe metadata.

Never include:

- Passwords.
- Raw refresh tokens.
- Raw authorization codes.
- Client secrets.
- Private keys.

### 20.4 Metrics

Recommended metrics:

- Login successes.
- Login failures.
- Token issuance count.
- Token endpoint error rate.
- Authorization endpoint error rate.
- Refresh token rotations.
- Refresh token replay detections.
- Active sessions.
- Active clients.
- JWKS request volume.
- Login latency.
- Token endpoint latency.

### 20.5 Alerts

Alert on:

- Spike in failed logins.
- Refresh token replay detection.
- Signing key compromise.
- Token endpoint error spike.
- Admin actions outside expected windows.
- Large number of session revocations.
- Disabled client receiving requests.

---

## 21. Admin Surface

The admin surface has two layers:

- Provider-local backend routes that enforce session, admin membership, recent
  authentication, CSRF/session posture, validation, pagination, and audit.
- A standalone React admin app later, using those backend routes as its contract.

The current server-rendered admin pages are acceptable as a temporary management
surface, but they should not become the long-term UI constraint. The backend
contract must remain usable by a separate admin frontend without weakening
Internal ID's provider-local authorization rules.

### 21.1 Admin Responsibilities

Admins need to manage:

- Users.
- Groups.
- Group memberships.
- Client applications.
- Redirect URIs.
- Client secrets.
- Sessions.
- Refresh token revocation.
- Audit logs.
- Signing key rotation, depending on operational model.

### 21.2 User Management

Admin user actions:

- Create user.
- Edit user profile.
- Set account status.
- Set temporary password or invite flow.
- Force password reset.
- Revoke all sessions.
- Revoke all refresh tokens.
- View audit history for user.

### 21.3 Group Management

Admin group actions:

- Create group.
- Rename group display name.
- Edit description.
- Add user to group.
- Remove user from group.
- View group membership.

Group slugs should be changed rarely because client apps may depend on them.

### 21.4 Client Management

Admin client actions:

- Create client.
- Disable client.
- Rotate client secret.
- Add redirect URI.
- Remove redirect URI.
- Configure allowed scopes.
- Configure claim release policy.
- Enable or disable refresh tokens.
- Set token lifetimes.
- View recent token activity.

### 21.5 Admin Authentication

Admin actions should require:

- Active provider session.
- Admin group or admin identity claim.
- Recent authentication for sensitive operations.
- CSRF protection for cookie-authenticated mutations.
- Request validation and pagination for list/search endpoints.
- Audit events for security-sensitive reads and all mutations.

Although Internal ID avoids app-specific authorization, it still needs internal
authorization for its own admin surface.

This is provider-local authorization, not authorization for external client apps.

---

## 22. Operational Model

### 22.1 Deployment

The provider should be deployed as a highly available internal service.

Minimum production posture:

- Multiple app instances.
- Shared PostgreSQL database.
- Shared session or token state.
- Centralized logs.
- Metrics and alerts.
- Automated backups.
- Secret management.

### 22.2 Configuration

Environment-specific configuration:

- Issuer URL.
- Database connection.
- Cookie name.
- Cookie domain.
- Allowed local development redirects.
- Token TTL defaults.
- Password hashing parameters.
- Signing key encryption settings.
- Audit sink configuration.

The issuer URL is security-sensitive. Changing it changes token validation.

### 22.3 Backups

Back up:

- Users.
- Groups.
- Clients.
- Redirect URIs.
- Refresh token state.
- Audit logs.
- Signing key metadata and encrypted private keys.

Backup restoration must be tested.

### 22.4 Data Retention

Recommended:

- Keep users indefinitely unless legal policy says otherwise.
- Keep audit events according to compliance policy.
- Purge expired authorization codes quickly.
- Purge or archive expired refresh token rows after a retention window.
- Keep deactivated users to preserve non-reassignable subject IDs.

### 22.5 Cleanup Jobs

Background jobs:

- Expire authorization codes.
- Expire provider sessions.
- Expire refresh tokens.
- Purge old transient records.
- Retire old signing keys after safe window.
- Emit warnings for clients with stale secrets.

### 22.6 Partitioning

Do not start with database partitioning unless scale demands it.

Start with:

- Good indexes.
- Cleanup jobs.
- Careful query patterns.

Consider partitioning later for:

- Very large audit tables.
- Very large refresh token history.
- High-volume token events.

---

## 23. MVP Build Plan

### 23.1 MVP Goals

The MVP should prove:

- Users can authenticate.
- Internal apps can use OIDC Authorization Code + PKCE.
- Tokens are signed and verifiable.
- Refresh token rotation works.
- Admins can manage users and clients.
- Security-sensitive actions are audited.

### 23.2 Phase 1: Foundation

Build:

- NestJS TypeScript project skeleton.
- NestJS module structure.
- TypeORM configuration.
- TypeORM data source.
- PostgreSQL database configuration.
- Initial TypeORM migrations.
- Better Auth configuration.
- NestJS Better Auth integration module.
- Better Auth database adapter and migrations.
- Better Auth OAuth Provider plugin configuration.
- Better Auth JWT plugin configuration.
- TypeORM entity definitions.
- User model.
- Credential model.
- Group model.
- Client model.
- Redirect URI model.
- Audit event model.
- Basic admin bootstrap.

Acceptance criteria:

- Better Auth starts with PostgreSQL.
- Better Auth OAuth/OIDC tables are created or mapped.
- TypeORM migrations can create and roll back the initial schema.
- TypeORM synchronization is disabled outside local experiments.
- An admin can create users.
- An admin can create clients.
- Redirect URIs are persisted and exact-match validated.
- Audit events are written for admin changes.
- Dynamic client registration is disabled.
- Unsupported grants and response types are rejected.

### 23.3 Phase 2: Authentication

Build:

- Login page.
- Better Auth email/password sign-in integration.
- Password verification.
- Provider session cookie.
- Session persistence.
- Logout.
- Login rate limiting.
- CSRF protection.

Acceptance criteria:

- Active users can log in.
- Suspended and deactivated users cannot log in.
- Login creates a secure provider session.
- Logout clears provider session.
- Failed logins are audited.
- Better Auth session behavior is wrapped by Internal ID lifecycle checks.

### 23.4 Phase 3: OIDC Discovery and Authorization

Build:

- Discovery endpoint.
- Authorization endpoint.
- Better Auth OAuth Provider route mounting or route wrappers.
- PKCE validation.
- Authorization code issuance.
- Authorization code storage.
- Redirect back to client.

Acceptance criteria:

- Valid authorization request returns code and state.
- Invalid redirect URI is rejected.
- Missing `openid` scope is rejected.
- Missing PKCE is rejected.
- `code_challenge_method=plain` is rejected.
- Codes expire and are one-time-use.
- `response_type=token`, `id_token`, and hybrid flows are rejected.

### 23.5 Phase 4: Token Issuance

Build:

- Signing key management.
- JWKS endpoint.
- Better Auth JWT plugin integration.
- Token endpoint authorization code exchange.
- ID token signing.
- Access token signing.
- ID token claims.
- UserInfo endpoint.

Acceptance criteria:

- Client can exchange code for tokens.
- ID token validates against JWKS.
- ID token contains expected claims.
- UserInfo returns allowed claims.
- Consumed authorization code cannot be reused.
- `password`, `client_credentials`, and device grants are rejected.

### 23.6 Phase 5: Refresh Tokens

Build:

- Optional refresh token issuance.
- Opaque refresh token generation.
- Token hashing.
- Rotation on use.
- Replay detection.
- Revocation endpoint.

Acceptance criteria:

- Refresh token returns new access token.
- Refresh token rotates on every use.
- Old refresh token reuse triggers replay event.
- Revocation prevents future refresh.

### 23.7 Phase 6: Admin Hardening

Build:

- Client secret rotation.
- Session revocation.
- User suspension flow.
- User deactivation flow.
- Audit views.
- Recent reauthentication for sensitive admin actions.
- Hardened `/admin/api/*` JSON endpoints for future standalone React admin
  management.

Acceptance criteria:

- Admin can disable client.
- Disabled client cannot authorize.
- Admin can revoke user sessions.
- Deactivated user cannot authenticate or refresh.
- Sensitive admin actions require recent authentication.
- Admin API mutations enforce CSRF/session posture, validation, and audit.
- `IdentityModule` and `ClientsModule` may remain empty placeholders until the
  admin API shape makes their service boundaries concrete.

---

## 24. Future Extensions

These are not part of the initial scope, but the architecture should avoid
blocking them.

### 24.1 MFA

Possible future MFA:

- TOTP.
- WebAuthn/passkeys.
- Backup codes.

### 24.2 Back-Channel Logout

Future client coordination could include back-channel logout so client apps can
receive logout notifications from Internal ID.

This is not required for MVP.

### 24.3 Better Session Management

Possible future improvements:

- User-facing session list.
- Device names.
- Trusted device management.
- Session anomaly notifications.

### 24.4 Advanced Audit Pipeline

Possible future improvements:

- Stream audit events to a data lake.
- SIEM integration.
- Automated suspicious activity detection.
- Long-term immutable storage.

### 24.5 Token Introspection

If opaque access tokens are chosen later, the provider may add token
introspection.

For the initial JWT-based model, local verification through JWKS is enough.

---

## Final Architecture Summary

Internal ID is an internal, OIDC-only identity provider.

It is the source of truth for users and groups. It authenticates users through
provider-owned login sessions and issues standards-based tokens to approved
internal clients. It publishes public signing keys through JWKS and supports
zero-downtime signing key rotation.

It does not implement SAML, social login, external federation, SCIM, device flow,
client credentials, or app-specific permissions.

The provider emits identity claims. Client applications consume those claims and
make their own authorization decisions.

This boundary keeps the platform focused, secure, and maintainable.
