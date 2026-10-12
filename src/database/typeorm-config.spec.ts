import { describe, expect, it } from 'vitest';
import type { AppEnvironment } from '../config/app-environment';
import { createTypeOrmOptions } from './typeorm.config';

function environmentWithDatabase(
  database: Partial<AppEnvironment['database']>,
): AppEnvironment {
  return {
    database: {
      url: 'postgres://postgres:postgres@localhost:5432/internal_id',
      logging: false,
      poolMax: 10,
      connectTimeoutMs: 10000,
      retryAttempts: 5,
      retryDelayMs: 3000,
      ...database,
    },
  } as AppEnvironment;
}

describe('createTypeOrmOptions', () => {
  it('maps pool sizing, timeout, and retry settings', () => {
    const options = createTypeOrmOptions(
      environmentWithDatabase({
        poolMax: 25,
        connectTimeoutMs: 5000,
        retryAttempts: 3,
        retryDelayMs: 1000,
      }),
    ) as unknown as Record<string, unknown>;

    expect(options.extra).toEqual({
      max: 25,
      connectionTimeoutMillis: 5000,
    });
    expect(options.retryAttempts).toBe(3);
    expect(options.retryDelay).toBe(1000);
  });

  it('uses documented defaults', () => {
    const options = createTypeOrmOptions(
      environmentWithDatabase({}),
    ) as unknown as Record<string, unknown>;

    expect(options.extra).toEqual({
      max: 10,
      connectionTimeoutMillis: 10000,
    });
    expect(options.retryAttempts).toBe(5);
    expect(options.retryDelay).toBe(3000);
  });
});
