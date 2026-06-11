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
    },
  };
}
