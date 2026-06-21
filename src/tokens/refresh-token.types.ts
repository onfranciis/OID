export interface IssueRefreshTokenInput {
  userId: string;
  clientId: string;
  providerSessionId?: string | null;
  idleTtlSeconds: number;
  absoluteTtlSeconds: number;
  upstreamRefreshToken?: string | null;
  now?: Date;
}

export interface RotateRefreshTokenInput {
  refreshToken: string;
  idleTtlSeconds: number;
  absoluteTtlSeconds: number;
  upstreamRefreshToken?: string | null;
  now?: Date;
}

export interface RotateRefreshTokenForClientInput {
  refreshToken: string;
  clientIdentifier: string;
  clientSecret?: string | null;
  now?: Date;
}

export interface IssueRefreshTokenResult {
  refreshToken: string;
  tokenId: string;
  familyId: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export interface IssueRefreshTokenForClientInput {
  userId: string;
  clientIdentifier: string;
  providerSessionId?: string | null;
  upstreamRefreshToken: string;
  now?: Date;
}

export interface ResolveRefreshGrantResult {
  upstreamRefreshToken: string;
  token: {
    id: string;
    familyId: string;
    userId: string;
    clientId: string;
    providerSessionId: string | null;
  };
}

export interface RotateRefreshTokenForClientResult extends IssueRefreshTokenResult {
  token: {
    id: string;
    familyId: string;
    userId: string;
    clientId: string;
    providerSessionId: string | null;
  };
  client: {
    id: string;
    clientId: string;
    accessTokenTtlSeconds: number;
    idTokenTtlSeconds: number;
    allowedClaims: string[];
  };
}

export interface RevokePresentedRefreshTokenInput {
  refreshToken: string;
  reason: string;
  now?: Date;
}
