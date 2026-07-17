# Client Integration Guide

Internal applications should use Internal ID through Authorization Code flow with
PKCE. Applications own their own local sessions; Internal ID proves who the user
is and issues identity tokens.

## Local Sample Client

1. Configure the provider in `.env`:

   ```bash
   BOOTSTRAP_CLIENT_ID=internal-id-sample-client
   BOOTSTRAP_CLIENT_SECRET=replace-this-sample-client-secret
   BOOTSTRAP_CLIENT_REDIRECT_URI=http://localhost:4000/auth/callback
   BOOTSTRAP_CLIENT_POST_LOGOUT_REDIRECT_URI=http://localhost:4000/logout/callback
   ```

2. Apply the provider schema and seed data:

   ```bash
   pnpm migration:run
   pnpm better-auth:schema
   pnpm seed:bootstrap
   ```

3. Start Internal ID:

   ```bash
   pnpm start:dev
   ```

4. Start the sample client in another shell:

   ```bash
   SAMPLE_CLIENT_SECRET=replace-this-sample-client-secret pnpm sample-client:start
   ```

5. Open `http://localhost:4000` and click "Sign in with Internal ID".

## Required Client Checks

Every client must validate the ID token before creating an app session:

- Signature: verify the JWT signature with the provider JWKS.
- Algorithm: only accept `RS256`.
- Issuer: match the discovery document `issuer`.
- Audience: match the application's registered `client_id`.
- Expiration: reject expired tokens.
- Nonce: match the nonce stored before redirecting to the provider.
- Subject: require a stable string `sub`.

The sample implementation lives in `sample-client/src/oidc-client.ts`.

## Session Boundary

Do not use provider access tokens as application sessions by default. The sample
client creates its own signed, HTTP-only local session cookie after ID token
validation. Store only the minimum identity attributes the app needs.

If the client requests `offline_access` and receives a refresh token, store it as
an application secret and revoke it during app logout.

## Logout

App logout:

- Clears the sample client's local session.
- Revokes the refresh token when one exists.
- Does not automatically clear the provider session.

Provider logout:

- `GET /oauth/end-session` implements OIDC RP-Initiated Logout 1.0 (advertised as
  `end_session_endpoint` in the discovery document). Accepts `id_token_hint`,
  `client_id`, `post_logout_redirect_uri`, and `state`.
- Always terminates the caller's provider session, the same work `POST /logout`
  does.
- Redirects to `post_logout_redirect_uri` (with `state` echoed) only when it is
  registered for the resolved client — resolved from an explicit `client_id`, or
  from `id_token_hint`'s `aud` claim once its signature is verified. Any
  unregistered or unresolvable redirect target is ignored in favor of the
  provider's own login page; it is never followed blindly.
- Register post-logout redirect URIs for a client the same way regular redirect
  URIs are registered (see the admin console / `OidcPostLogoutRedirectUriEntity`).

Applications should still expose their own app logout separately from provider
logout: clear the local session first, then send the browser to
`/oauth/end-session` (with `id_token_hint` from the original sign-in) to also end
the Internal ID session.
