export interface IssueRefreshTokenInput {
  userId: string;
  clientId: string;
  providerSessionId?: string | null;
  idleTtlSeconds: number;
  absoluteTtlSeconds: number;
  now?: Date;
}

export interface RotateRefreshTokenInput {
  refreshToken: string;
  idleTtlSeconds: number;
  absoluteTtlSeconds: number;
  now?: Date;
}

export interface IssueRefreshTokenResult {
  refreshToken: string;
  tokenId: string;
  familyId: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}
