import type { BadgeTone } from '../../components/status-badge';

export type OidcClientType = 'confidential' | 'public';
export type OidcClientStatus = 'active' | 'disabled';

export const CLIENT_TYPES: OidcClientType[] = ['confidential', 'public'];
export const CLIENT_STATUSES: OidcClientStatus[] = ['active', 'disabled'];

// Mirrors the provider's advertised scopes_supported/claims_supported
// (src/better-auth/better-auth.factory.ts) — the set an admin will pick from
// most of the time. Not an enforced enum: the backend accepts any non-empty
// string list, so the policy editor still allows adding others beyond these.
export const KNOWN_SCOPES = [
  'openid',
  'profile',
  'email',
  'groups',
  'offline_access',
];
export const KNOWN_CLAIMS = [
  'sub',
  'iss',
  'aud',
  'exp',
  'iat',
  'auth_time',
  'nonce',
  'email',
  'email_verified',
  'name',
  'given_name',
  'family_name',
  'preferred_username',
  'groups',
  'profile_type',
];

export interface ClientSummary {
  id: string;
  clientId: string;
  name: string;
  type: OidcClientType;
  status: OidcClientStatus;
  ownerTeam: string | null;
  hasSecret: boolean;
  createdAt: string;
}

export interface RedirectUri {
  id: string;
  uri: string;
}

export interface ClientDetail extends ClientSummary {
  allowedScopes: string[];
  allowedClaims: string[];
  requirePkce: boolean;
  allowRefreshTokens: boolean;
  accessTokenTtlSeconds: number;
  idTokenTtlSeconds: number;
  refreshTokenIdleTtlSeconds: number | null;
  refreshTokenAbsoluteTtlSeconds: number | null;
  updatedAt: string;
  redirectUris: RedirectUri[];
}

export interface ClientListResponse {
  items: ClientSummary[];
  nextCursor: string | null;
}

export interface AdminCreateClientInput {
  clientId: string;
  name: string;
  type?: OidcClientType;
  allowedScopes?: string[];
  allowedClaims?: string[];
  requirePkce?: boolean;
  allowRefreshTokens?: boolean;
  accessTokenTtlSeconds?: number;
  idTokenTtlSeconds?: number;
  refreshTokenIdleTtlSeconds?: number | null;
  refreshTokenAbsoluteTtlSeconds?: number | null;
  ownerTeam?: string | null;
}

export type AdminUpdateClientInput = Partial<
  Omit<AdminCreateClientInput, 'clientId' | 'type'>
>;

export interface RotateSecretResult {
  clientId: string;
  clientSecret: string;
}

export function clientStatusTone(status: OidcClientStatus): BadgeTone {
  return status === 'active' ? 'success' : 'danger';
}
