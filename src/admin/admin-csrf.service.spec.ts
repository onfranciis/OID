import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { AdminCsrfService } from './admin-csrf.service';

describe('AdminCsrfService', () => {
  const service = new AdminCsrfService({
    getOrThrow: vi.fn((key: string) => {
      if (key === 'authentication.csrfCookieName') {
        return 'internal_id_login_csrf';
      }

      if (key === 'betterAuth.secret') {
        return 'test-secret-with-at-least-32-characters';
      }

      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as unknown as ConfigService);

  it('generates verifiable CSRF tokens and scoped cookie headers', () => {
    const token = service.generateToken();

    expect(() => service.assertToken(token, token)).not.toThrow();
    expect(service.buildCookieHeader(token)).toContain('Path=/admin');
    expect(service.buildCookieHeader(token)).toContain('HttpOnly');
    expect(service.buildCookieHeader(token)).toContain('Secure');
  });

  it('rejects missing or mismatched CSRF tokens', () => {
    const token = service.generateToken();

    expect(() => service.assertToken(undefined, token)).toThrow(
      ForbiddenException,
    );
    expect(() => service.assertToken(token, undefined)).toThrow(
      ForbiddenException,
    );
    expect(() => service.assertToken(token, service.generateToken())).toThrow(
      ForbiddenException,
    );
  });
});
