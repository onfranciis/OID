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
    typeof config.BETTER_AUTH_SECRET === 'string' &&
    config.BETTER_AUTH_SECRET.length < 32
  ) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters long.');
  }

  if (
    config.BOOTSTRAP_ADMIN_PASSWORD !== undefined &&
    config.BOOTSTRAP_ADMIN_PASSWORD !== null &&
    typeof config.BOOTSTRAP_ADMIN_PASSWORD !== 'string'
  ) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be a string when provided.');
  }

  return config;
}
