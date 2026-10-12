import { describe, expect, it } from 'vitest';
import type { AppEnvironment } from '../config/app-environment';
import { buildPostgresSslConfig } from './postgres-ssl';

function environmentWithDatabase(
  database: Partial<AppEnvironment['database']>,
): AppEnvironment {
  return {
    database: {
      url: 'postgres://postgres:postgres@localhost:5432/internal_id',
      logging: false,
      sslEnabled: false,
      sslRejectUnauthorized: true,
      ...database,
    },
  } as AppEnvironment;
}

describe('buildPostgresSslConfig', () => {
  it('returns undefined when TLS is not enabled so pg honors PGSSLMODE', () => {
    expect(
      buildPostgresSslConfig(environmentWithDatabase({})),
    ).toBeUndefined();
  });

  it('enables verification by default when TLS is turned on', () => {
    expect(
      buildPostgresSslConfig(
        environmentWithDatabase({ sslEnabled: true }),
      ),
    ).toEqual({ rejectUnauthorized: true });
  });

  it('allows self signed certificates when explicitly configured', () => {
    expect(
      buildPostgresSslConfig(
        environmentWithDatabase({
          sslEnabled: true,
          sslRejectUnauthorized: false,
        }),
      ),
    ).toEqual({ rejectUnauthorized: false });
  });
});
