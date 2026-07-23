import { readEnv } from './env';
import type { AppEnvironment, NodeEnvironment } from './app-environment';

function env(key: string): string | undefined {
  return readEnv(process.env, key);
}

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
      name: env('APP_NAME') ?? 'internal-id',
      env: (env('NODE_ENV') as NodeEnvironment | undefined) ?? 'development',
      host: env('HOST') ?? '0.0.0.0',
      port: parseNumber(env('PORT'), 3000),
      // Required by validateEnvironment(); never falls back silently.
      baseUrl: env('APP_BASE_URL') as string,
    },
    database: {
      // Required by validateEnvironment(); never falls back silently.
      url: env('DATABASE_URL') as string,
      logging: parseBoolean(env('DATABASE_LOGGING'), false),
    },
    betterAuth: {
      basePath: env('BETTER_AUTH_BASE_PATH') ?? '/api/auth',
      cookieName: env('BETTER_AUTH_COOKIE_NAME') ?? 'internal_id_session',
      // Required by validateEnvironment(); never falls back silently.
      secret: env('BETTER_AUTH_SECRET') as string,
      loginPath: env('BETTER_AUTH_LOGIN_PATH') ?? '/admin/login',
      consentPath: env('BETTER_AUTH_CONSENT_PATH') ?? '/consent',
    },
    authentication: {
      csrfCookieName:
        env('AUTHENTICATION_CSRF_COOKIE_NAME') ?? 'internal_id_login_csrf',
      // Distinct name from csrfCookieName: different paths (/ vs /admin) must
      // not collide.
      adminCsrfCookieName:
        env('AUTHENTICATION_ADMIN_CSRF_COOKIE_NAME') ??
        'internal_id_admin_csrf',
      providerSessionCookieName:
        env('AUTHENTICATION_PROVIDER_SESSION_COOKIE_NAME') ??
        'internal_id_provider_session',
      providerSessionIdleTtlSeconds: parseNumber(
        env('AUTHENTICATION_PROVIDER_SESSION_IDLE_TTL_SECONDS'),
        43200,
      ),
      providerSessionAbsoluteTtlSeconds: parseNumber(
        env('AUTHENTICATION_PROVIDER_SESSION_ABSOLUTE_TTL_SECONDS'),
        604800,
      ),
      adminRecentAuthWindowSeconds: parseNumber(
        env('AUTHENTICATION_ADMIN_RECENT_AUTH_WINDOW_SECONDS'),
        600,
      ),
      loginRateLimitWindowSeconds: parseNumber(
        env('AUTHENTICATION_LOGIN_RATE_LIMIT_WINDOW_SECONDS'),
        600,
      ),
      loginRateLimitIpMaxAttempts: parseNumber(
        env('AUTHENTICATION_LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS'),
        10,
      ),
      loginRateLimitAccountMaxAttempts: parseNumber(
        env('AUTHENTICATION_LOGIN_RATE_LIMIT_ACCOUNT_MAX_ATTEMPTS'),
        5,
      ),
      tokenRateLimitWindowSeconds: parseNumber(
        env('AUTHENTICATION_TOKEN_RATE_LIMIT_WINDOW_SECONDS'),
        60,
      ),
      tokenRateLimitIpMaxAttempts: parseNumber(
        env('AUTHENTICATION_TOKEN_RATE_LIMIT_IP_MAX_ATTEMPTS'),
        60,
      ),
    },
    mail: {
      // Sandbox sender works without a verified domain; swap once one exists.
      resendApiKey: env('RESEND_API_KEY') ?? null,
      fromEmail:
        env('MAIL_FROM_EMAIL') ?? 'Internal ID <onboarding@resend.dev>',
      inviteTtlHours: parseNumber(env('MAIL_INVITE_TTL_HOURS'), 72),
      passwordResetTtlHours: parseNumber(
        env('MAIL_PASSWORD_RESET_TTL_HOURS'),
        1,
      ),
    },
    bootstrap: {
      adminEmail: env('BOOTSTRAP_ADMIN_EMAIL') ?? 'admin@company.com',
      adminDisplayName:
        env('BOOTSTRAP_ADMIN_DISPLAY_NAME') ?? 'Internal ID Administrator',
      adminGivenName: env('BOOTSTRAP_ADMIN_GIVEN_NAME') ?? 'Internal',
      adminFamilyName: env('BOOTSTRAP_ADMIN_FAMILY_NAME') ?? 'Administrator',
      adminUsername: env('BOOTSTRAP_ADMIN_USERNAME') ?? 'internal.admin',
      adminPassword: env('BOOTSTRAP_ADMIN_PASSWORD') ?? null,
      adminGroupSlug: env('BOOTSTRAP_ADMIN_GROUP_SLUG') ?? 'internal-id-admins',
      adminGroupName:
        env('BOOTSTRAP_ADMIN_GROUP_NAME') ?? 'Internal ID Administrators',
      clientId: env('BOOTSTRAP_CLIENT_ID') ?? 'internal-id-sample-client',
      clientName: env('BOOTSTRAP_CLIENT_NAME') ?? 'Internal ID Sample Client',
      clientSecret: env('BOOTSTRAP_CLIENT_SECRET') ?? null,
      clientRedirectUri:
        env('BOOTSTRAP_CLIENT_REDIRECT_URI') ??
        'http://localhost:4000/auth/callback',
      clientPostLogoutRedirectUri:
        env('BOOTSTRAP_CLIENT_POST_LOGOUT_REDIRECT_URI') ??
        'http://localhost:4000/logout/callback',
    },
  };
}
