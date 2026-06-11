import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface UserInfoTokenContext {
  clientId: string;
  scopes: string[];
  allowedClaims: string[];
}

@Injectable()
export class UserInfoPolicyService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async filterUserInfoClaims(
    authorizationHeader: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const accessToken = extractBearerToken(authorizationHeader);

    if (!accessToken) {
      return filterUserInfoPayload(payload, null);
    }

    const tokenContext = await this.loadTokenContext(accessToken);
    return filterUserInfoPayload(payload, tokenContext);
  }

  private async loadTokenContext(
    accessToken: string,
  ): Promise<UserInfoTokenContext | null> {
    const rowsUnknown = (await this.dataSource.query(
      `
        SELECT
          oat."clientId" AS client_id,
          oat."scopes" AS scopes,
          oc.allowed_claims AS allowed_claims
        FROM "oauthAccessToken" oat
        LEFT JOIN "oidc_clients" oc
          ON oc.client_id = oat."clientId"
        WHERE oat."accessToken" = $1
        LIMIT 1
      `,
      [accessToken],
    )) as unknown;

    const rows: unknown[] = Array.isArray(rowsUnknown) ? rowsUnknown : [];
    const row = rows[0];

    if (!isUserInfoTokenRow(row)) {
      return null;
    }

    return {
      clientId: row.client_id,
      scopes:
        typeof row.scopes === 'string'
          ? row.scopes.split(' ').filter(Boolean)
          : [],
      allowedClaims: Array.isArray(row.allowed_claims)
        ? row.allowed_claims.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
    };
  }
}

export function filterUserInfoPayload(
  payload: Record<string, unknown>,
  tokenContext: UserInfoTokenContext | null,
): Record<string, unknown> {
  const filteredPayload: Record<string, unknown> = {};

  if (typeof payload.sub === 'string') {
    filteredPayload.sub = payload.sub;
  }

  if (!tokenContext) {
    return filteredPayload;
  }

  const allowedClaims = new Set(tokenContext.allowedClaims);
  const scopes = new Set(tokenContext.scopes);

  copyClaimIfAllowed(
    filteredPayload,
    payload,
    'email',
    scopes.has('email') && allowedClaims.has('email'),
  );
  copyClaimIfAllowed(
    filteredPayload,
    payload,
    'email_verified',
    scopes.has('email') && allowedClaims.has('email_verified'),
  );
  copyClaimIfAllowed(
    filteredPayload,
    payload,
    'name',
    scopes.has('profile') && allowedClaims.has('name'),
  );
  copyClaimIfAllowed(
    filteredPayload,
    payload,
    'given_name',
    scopes.has('profile') && allowedClaims.has('given_name'),
  );
  copyClaimIfAllowed(
    filteredPayload,
    payload,
    'family_name',
    scopes.has('profile') && allowedClaims.has('family_name'),
  );
  copyClaimIfAllowed(
    filteredPayload,
    payload,
    'preferred_username',
    scopes.has('profile') && allowedClaims.has('preferred_username'),
  );
  copyClaimIfAllowed(
    filteredPayload,
    payload,
    'profile_type',
    scopes.has('profile') && allowedClaims.has('profile_type'),
  );
  copyClaimIfAllowed(
    filteredPayload,
    payload,
    'groups',
    scopes.has('groups') && allowedClaims.has('groups'),
  );

  return filteredPayload;
}

function copyClaimIfAllowed(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  claimName: string,
  allowed: boolean,
): void {
  if (!allowed || !(claimName in source)) {
    return;
  }

  target[claimName] = source[claimName];
}

function extractBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ', 2);

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

function isUserInfoTokenRow(value: unknown): value is {
  client_id: string;
  scopes?: unknown;
  allowed_claims?: unknown;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { client_id?: unknown }).client_id === 'string'
  );
}
