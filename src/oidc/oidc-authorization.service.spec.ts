import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { PkceChallengeMethod } from '../database/entities/oidc-authorization-code.entity';
import { OidcClientStatus } from '../database/entities/oidc-client.entity';
import { UserStatus } from '../database/entities/user.entity';
import { OidcAuthorizationService } from './oidc-authorization.service';

describe('OidcAuthorizationService', () => {
  const now = new Date('2026-06-21T12:00:00.000Z');
  const findClient = vi.fn();
  const findRedirectUri = vi.fn();
  const findProviderSession = vi.fn();
  const saveProviderSession = vi.fn((input: unknown) => Promise.resolve(input));
  const findUser = vi.fn();
  const createAuthorizationCode = vi.fn((input: unknown) => input);
  const saveAuthorizationCode = vi.fn((input: { id?: string }) =>
    Promise.resolve({
      ...input,
      id: input.id ?? 'cod_created',
    }),
  );
  const record = vi.fn<(input: unknown) => Promise<string>>(() =>
    Promise.resolve('evt_123'),
  );
  const service = new OidcAuthorizationService(
    {
      getOrThrow: vi.fn(() => '/login'),
    } as unknown as ConfigService,
    {
      findOne: findClient,
    } as never,
    {
      findOne: findRedirectUri,
    } as never,
    {
      findOne: findProviderSession,
      save: saveProviderSession,
    } as never,
    {
      findOne: findUser,
    } as never,
    {
      create: createAuthorizationCode,
      save: saveAuthorizationCode,
    } as never,
    {
      record,
    } as never,
  );

  beforeEach(() => {
    findClient.mockReset();
    findRedirectUri.mockReset();
    findProviderSession.mockReset();
    saveProviderSession.mockClear();
    findUser.mockReset();
    createAuthorizationCode.mockClear();
    saveAuthorizationCode.mockClear();
    record.mockClear();
    seedValidRequestState();
  });

  it('issues hashed authorization codes and redirects with code and state', async () => {
    const result = await service.authorize(validInput());

    const redirectedUrl = new URL(result.redirectTo);
    const rawCode = redirectedUrl.searchParams.get('code');

    expect(result.redirectTo).toContain(
      'https://app.company.com/callback?existing=1&code=',
    );
    expect(redirectedUrl.searchParams.get('state')).toBe('state_123');
    expect(rawCode).toBeTruthy();
    expect(createAuthorizationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'cli_internal',
        userId: 'usr_123',
        providerSessionId: 'psn_123',
        redirectUri: 'https://app.company.com/callback?existing=1',
        scope: 'openid email',
        codeChallenge: 'challenge_123',
        codeChallengeMethod: PkceChallengeMethod.S256,
        nonce: 'nonce_123',
        authTime: new Date('2026-06-21T11:55:00.000Z'),
        expiresAt: new Date('2026-06-21T12:05:00.000Z'),
        consumedAt: null,
      }),
    );
    expect(createAuthorizationCode.mock.calls[0]?.[0]).toMatchObject({
      codeHash: createHash('sha256')
        .update(rawCode ?? '')
        .digest('hex'),
    });
    expect(saveProviderSession).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSeenAt: now,
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oidc.authorization_code.issued',
        severity: AuditSeverity.INFO,
        actorUserId: 'usr_123',
        targetUserId: 'usr_123',
        clientId: 'cli_internal',
        providerSessionId: 'psn_123',
      }),
    );
  });

  it('rejects unknown and disabled clients', async () => {
    findClient.mockResolvedValueOnce(null);

    await expect(service.authorize(validInput())).rejects.toBeInstanceOf(
      BadRequestException,
    );

    findClient.mockResolvedValueOnce({
      id: 'cli_internal',
      clientId: 'internal-web',
      status: OidcClientStatus.DISABLED,
      allowedScopes: ['openid'],
    });

    await expect(service.authorize(validInput())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires exact registered redirect URIs', async () => {
    const redirectVariants = [
      'https://app.company.com/callback',
      'https://app.company.com/callback/',
      'https://app.company.com/callback?existing=1&next=1',
      'https://app.company.com/*',
    ];

    for (const redirectUri of redirectVariants) {
      findRedirectUri.mockResolvedValueOnce(null);

      await expect(
        service.authorize({
          ...validInput(),
          redirectUri,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('rejects unsupported response types', async () => {
    for (const responseType of ['token', 'id_token', 'code id_token']) {
      await expect(
        service.authorize({
          ...validInput(),
          responseType,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('requires state and PKCE S256', async () => {
    await expect(
      service.authorize({
        ...validInput(),
        state: undefined,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.authorize({
        ...validInput(),
        codeChallenge: undefined,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.authorize({
        ...validInput(),
        codeChallengeMethod: 'plain',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires openid and client-allowed scopes', async () => {
    await expect(
      service.authorize({
        ...validInput(),
        scope: 'email',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.authorize({
        ...validInput(),
        scope: 'openid profile',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('redirects unauthenticated users to login with request state preserved', async () => {
    findProviderSession.mockResolvedValueOnce(null);

    await expect(service.authorize(validInput())).resolves.toEqual({
      redirectTo:
        '/login?returnTo=%2Foauth%2Fauthorize%3Fclient_id%3Dinternal-web',
    });
  });

  it('returns login_required for prompt none without UI', async () => {
    findProviderSession.mockResolvedValueOnce(null);

    const result = await service.authorize({
      ...validInput(),
      prompt: 'none',
    });

    expect(result.redirectTo).toBe(
      'https://app.company.com/callback?existing=1&error=login_required&state=state_123',
    );
  });

  it('forces login for prompt login', async () => {
    await expect(
      service.authorize({
        ...validInput(),
        prompt: 'login',
        originalUrl:
          '/oauth/authorize?client_id=internal-web&prompt=login&state=state_123',
      }),
    ).resolves.toEqual({
      redirectTo:
        '/login?returnTo=%2Foauth%2Fauthorize%3Fclient_id%3Dinternal-web%26state%3Dstate_123',
    });

    expect(saveAuthorizationCode).not.toHaveBeenCalled();
  });

  it('rejects inactive users with an existing provider session', async () => {
    findUser.mockResolvedValueOnce({
      id: 'usr_123',
      status: UserStatus.SUSPENDED,
    });

    await expect(service.authorize(validInput())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  function seedValidRequestState(): void {
    findClient.mockResolvedValue({
      id: 'cli_internal',
      clientId: 'internal-web',
      status: OidcClientStatus.ACTIVE,
      allowedScopes: ['openid', 'email'],
    });
    findRedirectUri.mockResolvedValue({
      id: 'rdu_123',
      clientId: 'cli_internal',
      uri: 'https://app.company.com/callback?existing=1',
    });
    findProviderSession.mockResolvedValue({
      id: 'psn_123',
      userId: 'usr_123',
      sessionHash: 'hash',
      authTime: new Date('2026-06-21T11:55:00.000Z'),
      lastSeenAt: new Date('2026-06-21T11:59:00.000Z'),
      idleExpiresAt: new Date('2026-06-21T13:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-06-22T12:00:00.000Z'),
      revokedAt: null,
    });
    findUser.mockResolvedValue({
      id: 'usr_123',
      status: UserStatus.ACTIVE,
    });
  }

  function validInput() {
    return {
      responseType: 'code',
      clientId: 'internal-web',
      redirectUri: 'https://app.company.com/callback?existing=1',
      scope: 'openid email',
      state: 'state_123',
      codeChallenge: 'challenge_123',
      codeChallengeMethod: 'S256',
      nonce: 'nonce_123',
      providerSessionToken: 'provider-session-token',
      originalUrl: '/oauth/authorize?client_id=internal-web',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      now,
    };
  }
});
