import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BetterAuthService } from '../better-auth/better-auth.service';
import { AppConfigService } from '../config/app-config.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { UserStatus } from '../database/entities/user.entity';
import { AuthenticationService } from './authentication.service';
import { ProviderSessionService } from './provider-session.service';

describe('AuthenticationService', () => {
  const signInWithEmail = vi.fn<BetterAuthService['signInWithEmail']>(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          user: {
            id: 'usr_123',
          },
        }),
        {
          status: 200,
          headers: {
            'set-cookie':
              '__Secure-better-auth.session_token=test; Path=/; HttpOnly',
          },
        },
      ),
    ),
  );
  const signOut = vi.fn<BetterAuthService['signOut']>(() =>
    Promise.resolve(
      new Response(null, {
        status: 200,
        headers: {
          'set-cookie':
            '__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly',
        },
      }),
    ),
  );
  const record = vi.fn<(input: unknown) => Promise<string>>(() =>
    Promise.resolve('evt_123'),
  );
  const assertAllowed =
    vi.fn<(ipAddress: string | null, normalizedEmail: string) => void>();
  const recordFailure =
    vi.fn<(ipAddress: string | null, normalizedEmail: string) => void>();
  const recordSuccess =
    vi.fn<(ipAddress: string | null, normalizedEmail: string) => void>();
  const issue = vi.fn<
    (
      input: unknown,
    ) => Promise<{ record: { id: string; authTime: Date }; token: string }>
  >(() =>
    Promise.resolve({
      record: {
        id: 'psn_123',
        authTime: new Date('2026-06-11T12:00:00.000Z'),
      },
      token: 'provider-session-token',
    }),
  );
  const revoke = vi.fn<(token: string, reason: string) => Promise<null>>(() =>
    Promise.resolve(null),
  );
  const buildCookieHeader = vi.fn<
    (token: string, maxAgeSeconds: number) => string
  >(
    () =>
      'internal_id_provider_session=provider-session-token; HttpOnly; Secure',
  );
  const buildClearedCookieHeader = vi.fn<() => string>(
    () => 'internal_id_provider_session=; Max-Age=0; HttpOnly; Secure',
  );
  const findOne = vi.fn<
    (input: unknown) => Promise<{
      id: string;
      normalizedEmail: string;
      status: UserStatus;
    } | null>
  >(() =>
    Promise.resolve({
      id: 'usr_123',
      normalizedEmail: 'admin@company.com',
      status: UserStatus.ACTIVE,
    }),
  );

  const service = new AuthenticationService(
    {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'authentication.csrfCookieName':
            return 'internal_id_login_csrf';
          case 'betterAuth.secret':
            return 'test-secret';
          case 'authentication.providerSessionAbsoluteTtlSeconds':
            return 604800;
          default:
            throw new Error(`Unexpected config key: ${key}`);
        }
      }),
    } as unknown as AppConfigService,
    {
      signInWithEmail,
      signOut,
    } as unknown as BetterAuthService,
    {
      record,
    } as never,
    {
      assertAllowed,
      recordFailure,
      recordSuccess,
    } as never,
    {
      issue,
      revoke,
      buildCookieHeader,
      buildClearedCookieHeader,
    } as unknown as ProviderSessionService,
    {
      findOne,
    } as never,
  );

  beforeEach(() => {
    signInWithEmail.mockClear();
    signOut.mockClear();
    record.mockClear();
    assertAllowed.mockClear();
    recordFailure.mockClear();
    recordSuccess.mockClear();
    issue.mockClear();
    revoke.mockClear();
    buildCookieHeader.mockClear();
    buildClearedCookieHeader.mockClear();
    findOne.mockClear();
  });

  it('issues a login CSRF token with a fresh cookie', () => {
    const result = service.initLogin();

    expect(result.csrfToken).toMatch(/\./);
    expect(result.csrfCookieHeader).toContain('internal_id_login_csrf=');
    expect(result.csrfCookieHeader).toContain('HttpOnly');
    expect(result.csrfCookieHeader).toContain('Secure');
  });

  it('rejects missing CSRF tokens', async () => {
    await expect(
      service.login(
        {
          email: 'admin@company.com',
          password: 'password',
          csrfToken: '',
        },
        {
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
          headers: {},
          cookies: {},
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects inactive local users before Better Auth is called', async () => {
    findOne.mockResolvedValueOnce({
      id: 'usr_123',
      normalizedEmail: 'admin@company.com',
      status: UserStatus.SUSPENDED,
    });
    const csrfToken = readCookieValue(service.initLogin().csrfCookieHeader);

    await expect(
      service.login(
        {
          email: 'Admin@Company.com',
          password: 'password',
          csrfToken,
        },
        {
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
          headers: {},
          cookies: {
            internal_id_login_csrf: csrfToken,
          },
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(signInWithEmail).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'user.login.rejected',
        severity: AuditSeverity.WARNING,
      }),
    );
  });

  it('translates Better Auth success into provider session cookies and audit events', async () => {
    const csrfToken = readCookieValue(service.initLogin().csrfCookieHeader);

    const result = await service.login(
      {
        email: 'Admin@Company.com',
        password: 'password',
        csrfToken,
        returnTo: '/authorize',
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
        headers: {
          host: 'localhost:3000',
        },
        cookies: {
          internal_id_login_csrf: csrfToken,
        },
      },
    );

    expect(assertAllowed).toHaveBeenCalledWith(
      '127.0.0.1',
      'admin@company.com',
    );
    expect(signInWithEmail).toHaveBeenCalledTimes(1);
    expect(issue).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'usr_123',
      }),
    );
    expect(recordSuccess).toHaveBeenCalledWith(
      '127.0.0.1',
      'admin@company.com',
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'provider.session.issued',
        severity: AuditSeverity.INFO,
      }),
    );
    expect(result.redirectTo).toBe('/authorize');
    expect(result.responseHeaders).toContain(
      'internal_id_provider_session=provider-session-token; HttpOnly; Secure',
    );
  });

  it('turns Better Auth failures into a generic unauthorized response', async () => {
    signInWithEmail.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'INVALID_EMAIL_OR_PASSWORD' }), {
        status: 401,
      }),
    );
    const csrfToken = readCookieValue(service.initLogin().csrfCookieHeader);

    await expect(
      service.login(
        {
          email: 'admin@company.com',
          password: 'wrong-password',
          csrfToken,
        },
        {
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
          headers: {},
          cookies: {
            internal_id_login_csrf: csrfToken,
          },
        },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(recordFailure).toHaveBeenCalledWith(
      '127.0.0.1',
      'admin@company.com',
    );
  });

  it('propagates rate-limit denials', async () => {
    assertAllowed.mockImplementationOnce(() => {
      throw new HttpException('blocked', HttpStatus.TOO_MANY_REQUESTS);
    });
    const csrfToken = readCookieValue(service.initLogin().csrfCookieHeader);

    await expect(
      service.login(
        {
          email: 'admin@company.com',
          password: 'wrong-password',
          csrfToken,
        },
        {
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
          headers: {},
          cookies: {
            internal_id_login_csrf: csrfToken,
          },
        },
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });
});

function readCookieValue(cookieHeader: string): string {
  const separatorIndex = cookieHeader.indexOf('=');
  const delimiterIndex = cookieHeader.indexOf(';');

  return decodeURIComponent(
    cookieHeader.slice(
      separatorIndex + 1,
      delimiterIndex === -1 ? undefined : delimiterIndex,
    ),
  );
}
