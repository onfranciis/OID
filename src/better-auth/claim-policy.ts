import type { Kysely } from 'kysely';

export interface BetterAuthOidcClient {
  clientId: string;
}

export interface BetterAuthOidcUser {
  id: string;
}

export interface InternalUserClaimRecord {
  username: string | null;
  profileType: string;
  groups: string[];
}

export async function getAdditionalUserInfoClaims(
  db: Kysely<unknown>,
  user: BetterAuthOidcUser,
  scopes: string[],
  client: BetterAuthOidcClient,
): Promise<Record<string, unknown>> {
  const clientPolicy = await loadClientClaimPolicy(db, client.clientId);

  if (!clientPolicy) {
    return {};
  }

  const internalUserClaims = await loadInternalUserClaimRecord(db, user.id);

  if (!internalUserClaims) {
    return {};
  }

  return buildAllowedAdditionalClaims(
    clientPolicy.allowedClaims,
    scopes,
    internalUserClaims,
  );
}

export function buildAllowedAdditionalClaims(
  allowedClaims: string[],
  scopes: string[],
  user: InternalUserClaimRecord,
): Record<string, unknown> {
  const allowedClaimSet = new Set(allowedClaims);
  const scopeSet = new Set(scopes);
  const claims: Record<string, unknown> = {};

  if (
    scopeSet.has('profile') &&
    allowedClaimSet.has('preferred_username') &&
    user.username
  ) {
    claims.preferred_username = user.username;
  }

  if (
    scopeSet.has('profile') &&
    allowedClaimSet.has('profile_type') &&
    user.profileType
  ) {
    claims.profile_type = user.profileType;
  }

  if (
    scopeSet.has('groups') &&
    allowedClaimSet.has('groups') &&
    user.groups.length > 0
  ) {
    claims.groups = user.groups;
  }

  return claims;
}

async function loadClientClaimPolicy(
  db: Kysely<unknown>,
  clientIdentifier: string,
): Promise<{ allowedClaims: string[] } | null> {
  const dynamicDb = db as Kysely<any>;
  const row = await dynamicDb
    .selectFrom('oidc_clients')
    .select(['allowed_claims'])
    .where('client_id', '=', clientIdentifier)
    .executeTakeFirst();

  if (!row) {
    return null;
  }

  const allowedClaimsValue = (row as { allowed_claims?: unknown })
    .allowed_claims;
  const allowedClaims = Array.isArray(allowedClaimsValue)
    ? allowedClaimsValue.filter(
        (value): value is string => typeof value === 'string',
      )
    : [];

  return {
    allowedClaims,
  };
}

async function loadInternalUserClaimRecord(
  db: Kysely<unknown>,
  userId: string,
): Promise<InternalUserClaimRecord | null> {
  const dynamicDb = db as Kysely<any>;
  const userRow = await dynamicDb
    .selectFrom('users')
    .select(['username', 'profile_type'])
    .where('id', '=', userId)
    .executeTakeFirst();

  if (!userRow) {
    return null;
  }

  const groupRows = await dynamicDb
    .selectFrom('group_memberships')
    .innerJoin('groups', 'groups.id', 'group_memberships.group_id')
    .select(['groups.slug'])
    .where('group_memberships.user_id', '=', userId)
    .orderBy('groups.slug asc')
    .execute();

  return {
    username:
      typeof (userRow as { username?: unknown }).username === 'string'
        ? ((userRow as { username: string }).username ?? null)
        : null,
    profileType:
      typeof (userRow as { profile_type?: unknown }).profile_type === 'string'
        ? (userRow as { profile_type: string }).profile_type
        : '',
    groups: groupRows
      .map((row) => {
        const slug = (row as { slug?: unknown }).slug;

        return typeof slug === 'string' ? slug : null;
      })
      .filter((value): value is string => value !== null),
  };
}
