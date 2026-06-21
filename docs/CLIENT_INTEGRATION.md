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

- Posts to Internal ID `/logout`.
- Clears the provider session.
- Currently redirects to the provider login page because Internal ID does not yet
  implement an OIDC RP-initiated logout endpoint.

Applications should expose app logout separately from provider logout until a
dedicated OIDC logout endpoint is added.
