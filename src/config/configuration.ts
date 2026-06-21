import type { AppEnvironment, NodeEnvironment } from './app-environment';

function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return value === 'true';
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isNaN(parsedValue) ? defaultValue : parsedValue;
}

export function configuration(): AppEnvironment {
  return {
    app: {
      name: process.env.APP_NAME ?? 'internal-id',
      env:
        (process.env.NODE_ENV as NodeEnvironment | undefined) ?? 'development',
      host: process.env.HOST ?? '0.0.0.0',
      port: parseNumber(process.env.PORT, 3000),
      baseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
    },
    database: {
      url:
        process.env.DATABASE_URL ??
        'postgres://postgres:postgres@localhost:5432/internal_id',
      logging: parseBoolean(process.env.DATABASE_LOGGING, false),
    },
    betterAuth: {
      basePath: process.env.BETTER_AUTH_BASE_PATH ?? '/api/auth',
      cookieName: process.env.BETTER_AUTH_COOKIE_NAME ?? 'internal_id_session',
      secret:
        process.env.BETTER_AUTH_SECRET ??
        'development-only-better-auth-secret-change-me',
      loginPath: process.env.BETTER_AUTH_LOGIN_PATH ?? '/login',
    },
    authentication: {
      csrfCookieName:
        process.env.AUTHENTICATION_CSRF_COOKIE_NAME ?? 'internal_id_login_csrf',
      providerSessionCookieName:
        process.env.AUTHENTICATION_PROVIDER_SESSION_COOKIE_NAME ??
        'internal_id_provider_session',
      providerSessionIdleTtlSeconds: parseNumber(
        process.env.AUTHENTICATION_PROVIDER_SESSION_IDLE_TTL_SECONDS,
        43200,
      ),
      providerSessionAbsoluteTtlSeconds: parseNumber(
        process.env.AUTHENTICATION_PROVIDER_SESSION_ABSOLUTE_TTL_SECONDS,
        604800,
      ),
      adminRecentAuthWindowSeconds: parseNumber(
        process.env.AUTHENTICATION_ADMIN_RECENT_AUTH_WINDOW_SECONDS,
        600,
      ),
      loginRateLimitWindowSeconds: parseNumber(
        process.env.AUTHENTICATION_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        600,
      ),
      loginRateLimitIpMaxAttempts: parseNumber(
        process.env.AUTHENTICATION_LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS,
        10,
      ),
      loginRateLimitAccountMaxAttempts: parseNumber(
        process.env.AUTHENTICATION_LOGIN_RATE_LIMIT_ACCOUNT_MAX_ATTEMPTS,
        5,
      ),
      tokenRateLimitWindowSeconds: parseNumber(
        process.env.AUTHENTICATION_TOKEN_RATE_LIMIT_WINDOW_SECONDS,
        60,
      ),
      tokenRateLimitIpMaxAttempts: parseNumber(
        process.env.AUTHENTICATION_TOKEN_RATE_LIMIT_IP_MAX_ATTEMPTS,
        60,
      ),
    },
    bootstrap: {
      adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@company.com',
      adminDisplayName:
        process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME ?? 'Internal ID Administrator',
      adminGivenName: process.env.BOOTSTRAP_ADMIN_GIVEN_NAME ?? 'Internal',
      adminFamilyName:
        process.env.BOOTSTRAP_ADMIN_FAMILY_NAME ?? 'Administrator',
      adminUsername: process.env.BOOTSTRAP_ADMIN_USERNAME ?? 'internal.admin',
      adminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? null,
      adminGroupSlug:
        process.env.BOOTSTRAP_ADMIN_GROUP_SLUG ?? 'internal-id-admins',
      adminGroupName:
        process.env.BOOTSTRAP_ADMIN_GROUP_NAME ?? 'Internal ID Administrators',
      clientId: process.env.BOOTSTRAP_CLIENT_ID ?? 'internal-id-sample-client',
      clientName:
        process.env.BOOTSTRAP_CLIENT_NAME ?? 'Internal ID Sample Client',
      clientRedirectUri:
        process.env.BOOTSTRAP_CLIENT_REDIRECT_URI ??
        'http://localhost:4000/auth/callback',
      clientPostLogoutRedirectUri:
        process.env.BOOTSTRAP_CLIENT_POST_LOGOUT_REDIRECT_URI ??
        'http://localhost:4000/logout/callback',
    },
  };
}
