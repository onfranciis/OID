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

  return config;
}
