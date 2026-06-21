const allowedNodeEnvironments = new Set(['development', 'test', 'production']);

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = config.NODE_ENV;
  const port = config.PORT;

  if (nodeEnv !== undefined && typeof nodeEnv !== 'string') {
    throw new Error('NODE_ENV must be a string when provided.');
  }

  if (typeof nodeEnv === 'string' && !allowedNodeEnvironments.has(nodeEnv)) {
    throw new Error(
      'NODE_ENV must be one of development, test, or production.',
    );
  }

  if (port !== undefined) {
    if (typeof port !== 'string') {
      throw new Error('PORT must be a string when provided.');
    }

    const parsedPort = Number.parseInt(port, 10);

    if (Number.isNaN(parsedPort) || parsedPort <= 0) {
      throw new Error('PORT must be a positive integer.');
    }
  }

  if (
    typeof config.DATABASE_URL !== 'string' ||
    config.DATABASE_URL.length === 0
  ) {
    throw new Error('DATABASE_URL is required.');
  }

  if (
    config.BETTER_AUTH_SECRET !== undefined &&
    typeof config.BETTER_AUTH_SECRET !== 'string'
  ) {
    throw new Error('BETTER_AUTH_SECRET must be a string when provided.');
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
    validateProductionEnvironment(config);
  }

  if (
    typeof config.BETTER_AUTH_SECRET === 'string' &&
    config.BETTER_AUTH_SECRET.length < 32
  ) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters long.');
  }

  return config;
}

function validateProductionEnvironment(config: Record<string, unknown>): void {
  if (
    typeof config.APP_BASE_URL !== 'string' ||
    !config.APP_BASE_URL.startsWith('https://')
  ) {
    throw new Error('APP_BASE_URL must use https:// in production.');
  }

  if (typeof config.BETTER_AUTH_SECRET !== 'string') {
    throw new Error('BETTER_AUTH_SECRET is required in production.');
  }

  if (
    config.BETTER_AUTH_SECRET ===
      'development-only-better-auth-secret-change-me' ||
    config.BETTER_AUTH_SECRET === 'replace-this-before-production'
  ) {
    throw new Error('BETTER_AUTH_SECRET must not use a development default.');
  }

  if (config.BOOTSTRAP_ADMIN_PASSWORD === 'change-this-for-local-bootstrap') {
    throw new Error(
      'BOOTSTRAP_ADMIN_PASSWORD must not use the local development default.',
    );
  }

  if (config.BOOTSTRAP_CLIENT_SECRET === 'replace-this-sample-client-secret') {
    throw new Error(
      'BOOTSTRAP_CLIENT_SECRET must not use the sample development default.',
    );
  }
}
