import { readEnv } from './env';

const allowedNodeEnvironments = new Set(['development', 'test', 'production']);

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = readEnv(config, 'NODE_ENV');
  const port = readEnv(config, 'PORT');
  const databaseUrl = readEnv(config, 'DATABASE_URL');
  const appBaseUrl = readEnv(config, 'APP_BASE_URL');
  const betterAuthSecret = readEnv(config, 'BETTER_AUTH_SECRET');
  const bootstrapAdminPassword = readEnv(config, 'BOOTSTRAP_ADMIN_PASSWORD');
  const bootstrapClientSecret = readEnv(config, 'BOOTSTRAP_CLIENT_SECRET');

  if (config.NODE_ENV !== undefined && typeof config.NODE_ENV !== 'string') {
    throw new Error('NODE_ENV must be a string when provided.');
  }

  if (nodeEnv !== undefined && !allowedNodeEnvironments.has(nodeEnv)) {
    throw new Error(
      'NODE_ENV must be one of development, test, or production.',
    );
  }

  if (config.PORT !== undefined) {
    if (typeof config.PORT !== 'string') {
      throw new Error('PORT must be a string when provided.');
    }

    const parsedPort = Number.parseInt(port ?? '', 10);

    if (Number.isNaN(parsedPort) || parsedPort <= 0) {
      throw new Error('PORT must be a positive integer.');
    }
  }

  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required.');
  }

  if (appBaseUrl === undefined) {
    throw new Error('APP_BASE_URL is required.');
  }

  if (betterAuthSecret === undefined) {
    throw new Error('BETTER_AUTH_SECRET is required.');
  }

  if (
    config.BOOTSTRAP_ADMIN_PASSWORD !== undefined &&
    config.BOOTSTRAP_ADMIN_PASSWORD !== null &&
    typeof config.BOOTSTRAP_ADMIN_PASSWORD !== 'string'
  ) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be a string when provided.');
  }

  if (
    config.BOOTSTRAP_CLIENT_SECRET !== undefined &&
    config.BOOTSTRAP_CLIENT_SECRET !== null &&
    typeof config.BOOTSTRAP_CLIENT_SECRET !== 'string'
  ) {
    throw new Error('BOOTSTRAP_CLIENT_SECRET must be a string when provided.');
  }

  if (nodeEnv === 'production') {
    validateProductionEnvironment({
      appBaseUrl,
      betterAuthSecret,
      bootstrapAdminPassword,
      bootstrapClientSecret,
    });
  }

  if (betterAuthSecret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters long.');
  }

  return config;
}

function validateProductionEnvironment(env: {
  appBaseUrl: string;
  betterAuthSecret: string;
  bootstrapAdminPassword: string | undefined;
  bootstrapClientSecret: string | undefined;
}): void {
  if (!env.appBaseUrl.startsWith('https://')) {
    throw new Error('APP_BASE_URL must use https:// in production.');
  }

  if (
    env.betterAuthSecret === 'development-only-better-auth-secret-change-me' ||
    env.betterAuthSecret === 'replace-this-before-production-with-32-plus-chars'
  ) {
    throw new Error('BETTER_AUTH_SECRET must not use a development default.');
  }

  if (env.bootstrapAdminPassword === 'change-this-for-local-bootstrap') {
    throw new Error(
      'BOOTSTRAP_ADMIN_PASSWORD must not use the local development default.',
    );
  }

  if (env.bootstrapClientSecret === 'replace-this-sample-client-secret') {
    throw new Error(
      'BOOTSTRAP_CLIENT_SECRET must not use the sample development default.',
    );
  }
}
