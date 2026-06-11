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
