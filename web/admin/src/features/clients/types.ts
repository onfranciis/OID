import type { BadgeTone } from '../../components/status-badge';

// Shapes from docs/ADMIN_API_CONTRACT.md, mirroring OidcClientEntity and the
// AdminClientService input interfaces.

export type OidcClientType = 'confidential' | 'public';
export type OidcClientStatus = 'active' | 'disabled';

export const CLIENT_TYPES: OidcClientType[] = ['confidential', 'public'];
export const CLIENT_STATUSES: OidcClientStatus[] = ['active', 'disabled'];

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
  return status === 'active' ? 'accent' : 'danger';
}
