# Admin Authorization Model

Internal ID admin access is provider-local. A user is an admin only when all of
these conditions are true:

- The request has a valid `internal_id_provider_session` cookie.
- The provider session exists, is not revoked, and has not passed idle or
  absolute expiry.
- The session user exists and has `status = active`.
- The user is a member of the configured bootstrap admin group
  `BOOTSTRAP_ADMIN_GROUP_SLUG`.

This deliberately avoids trusting OIDC client roles, external claims, or Better
Auth session metadata for admin authorization. The Internal ID database remains
the source of truth for administrative power.
