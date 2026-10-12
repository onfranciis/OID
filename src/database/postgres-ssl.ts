import type { AppEnvironment } from '../config/app-environment';

export interface PostgresSslConfig {
  rejectUnauthorized: boolean;
}

// Single home for the TLS posture of every direct Postgres pool in the app.
// Returns undefined when TLS is not explicitly enabled so that `pg` falls
// back to its standard behavior: honoring PGSSLMODE and connection-string
// sslmode params. Never returns `false`, which would override those signals
// and force plaintext.
export function buildPostgresSslConfig(
  appEnvironment: AppEnvironment,
): PostgresSslConfig | undefined {
  if (!appEnvironment.database.sslEnabled) {
    return undefined;
  }

  return {
    rejectUnauthorized: appEnvironment.database.sslRejectUnauthorized,
  };
}
