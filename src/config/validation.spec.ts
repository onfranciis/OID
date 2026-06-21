import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './validation';

describe('validateEnvironment', () => {
  const baseConfig = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/internal_id',
    APP_BASE_URL: 'https://auth.company.com',
    BETTER_AUTH_SECRET: 'production-secret-with-at-least-32-characters',
    BOOTSTRAP_ADMIN_PASSWORD: 'not-the-local-default',
  };

  it('accepts secure production configuration', () => {
    expect(validateEnvironment(baseConfig)).toBe(baseConfig);
  });

  it('rejects insecure production base URLs', () => {
    expect(() =>
      validateEnvironment({
        ...baseConfig,
        APP_BASE_URL: 'http://auth.company.com',
      }),
    ).toThrow(/https/);
  });

  it('rejects production development defaults', () => {
    expect(() =>
      validateEnvironment({
        ...baseConfig,
        BETTER_AUTH_SECRET: 'replace-this-before-production',
      }),
    ).toThrow(/development default/);
    expect(() =>
      validateEnvironment({
        ...baseConfig,
        BOOTSTRAP_ADMIN_PASSWORD: 'change-this-for-local-bootstrap',
      }),
    ).toThrow(/local development default/);
  });

  it('rejects malformed bootstrap password values before production checks', () => {
    expect(() =>
      validateEnvironment({
        ...baseConfig,
        BOOTSTRAP_ADMIN_PASSWORD: 123,
      }),
    ).toThrow(/BOOTSTRAP_ADMIN_PASSWORD/);
  });
});
