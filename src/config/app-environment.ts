export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppEnvironment {
  app: {
    name: string;
    env: NodeEnvironment;
    host: string;
    port: number;
    baseUrl: string;
  };
  database: {
    url: string;
    logging: boolean;
  };
  betterAuth: {
    basePath: string;
    cookieName: string;
    secret: string;
    loginPath: string;
  };
  authentication: {
    csrfCookieName: string;
    providerSessionCookieName: string;
    providerSessionIdleTtlSeconds: number;
    providerSessionAbsoluteTtlSeconds: number;
    adminRecentAuthWindowSeconds: number;
    loginRateLimitWindowSeconds: number;
    loginRateLimitIpMaxAttempts: number;
    loginRateLimitAccountMaxAttempts: number;
    tokenRateLimitWindowSeconds: number;
    tokenRateLimitIpMaxAttempts: number;
  };
  bootstrap: {
    adminEmail: string;
    adminDisplayName: string;
    adminGivenName: string | null;
    adminFamilyName: string | null;
    adminUsername: string | null;
    adminPassword: string | null;
    adminGroupSlug: string;
    adminGroupName: string;
    clientId: string;
    clientName: string;
    clientRedirectUri: string;
    clientPostLogoutRedirectUri: string;
  };
}
