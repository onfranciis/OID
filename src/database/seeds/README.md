Bootstrap data is applied through `pnpm seed:bootstrap`.

The script is intentionally idempotent. It creates or updates:

- one active bootstrap admin user
- one bootstrap admin group
- one membership binding that user to that group
- one sample confidential OIDC client, with a secret hash when
  `BOOTSTRAP_CLIENT_SECRET` is set
- one redirect URI and one post-logout redirect URI for that client

Secrets and password credentials are not seeded here because Better Auth is the
current owner of base credential primitives in the roadmap.
