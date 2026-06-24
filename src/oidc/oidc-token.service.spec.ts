import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../config/app-config.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import {
  OidcClientStatus,
  OidcClientType,
} from '../database/entities/oidc-client.entity';
import { UserProfileType, UserStatus } from '../database/entities/user.entity';
import { OidcTokenService } from './oidc-token.service';

describe('OidcTokenService', () => {
  const now = new Date('2026-06-21T12:00:00.000Z');
  const codeRepository = {
    findOne: vi.fn(),
    save: vi.fn((input: unknown) => Promise.resolve(input)),
  };
  const clientRepository = {
    findOne: vi.fn(),
  };
  const userRepository = {
    findOne: vi.fn(),
  };
  const dataSource = {
    transaction: vi.fn((callback: (manager: unknown) => unknown) =>
      callback({
        getRepository: (entity: { name: string }) => {
          if (entity.name === 'OidcAuthorizationCodeEntity') {
            return codeRepository;
          }

          if (entity.name === 'OidcClientEntity') {
            return clientRepository;
          }

          if (entity.name === 'UserEntity') {
            return userRepository;
          }

          throw new Error(`Unexpected repository: ${entity.name}`);
        },
      }),
    ),
  };
  const signingRepository = {
    findOne: vi.fn(),
    create: vi.fn((input: unknown) => input),
    save: vi.fn((input: unknown) => Promise.resolve(input)),
  };
  const topLevelUserRepository = {
    findOne: vi.fn(),
  };
  const topLevelClientRepository = {
    findOne: vi.fn(),
  };
  const record = vi.fn<(input: unknown) => Promise<string>>(() =>
    Promise.resolve('evt_123'),
  );
  const issueRefreshToken = vi.fn(() =>
    Promise.resolve({
      refreshToken: 'issued-refresh-token',
      tokenId: 'rtk_issued',
      familyId: 'rtf_issued',
      idleExpiresAt: new Date('2026-06-21T13:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-06-22T12:00:00.000Z'),
    }),
  );
  const rotateTokenForClient = vi.fn(() =>
    Promise.resolve({
      refreshToken: 'rotated-refresh-token',
      tokenId: 'rtk_rotated',
      familyId: 'rtf_issued',
      idleExpiresAt: new Date('2026-06-21T13:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-06-22T12:00:00.000Z'),
      token: {
        id: 'rtk_rotated',
        familyId: 'rtf_issued',
        userId: 'usr_123',
        clientId: 'cli_123',
        providerSessionId: 'psn_123',
      },
      client: {
        id: 'cli_123',
        clientId: 'internal-web',
        accessTokenTtlSeconds: 600,
        idTokenTtlSeconds: 900,
        allowedClaims: ['email', 'name'],
      },
    }),
  );
  const revokePresentedToken = vi.fn(() => Promise.resolve());
  const service = new OidcTokenService(
    {
      get: vi.fn((key: string) => {
        if (key === 'app.baseUrl') {
          return 'https://auth.company.com';
        }

        if (key === 'betterAuth.secret') {
          return 'test-signing-secret-with-at-least-32-chars';
        }

        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as AppConfigService,
    dataSource as never,
    signingRepository as never,
    topLevelUserRepository as never,
    topLevelClientRepository as never,
    {
      record,
    } as never,
    {
      issueToken: issueRefreshToken,
      rotateTokenForClient,
      revokePresentedToken,
    } as never,
  );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    codeRepository.findOne.mockReset();
    codeRepository.save.mockClear();
    clientRepository.findOne.mockReset();
    userRepository.findOne.mockReset();
    signingRepository.findOne.mockReset();
    signingRepository.create.mockClear();
    signingRepository.save.mockClear();
    topLevelUserRepository.findOne.mockReset();
    topLevelClientRepository.findOne.mockReset();
    record.mockClear();
    issueRefreshToken.mockClear();
    rotateTokenForClient.mockClear();
    revokePresentedToken.mockClear();
    seedValidExchangeState();
  });

  it('exchanges valid authorization codes for signed tokens', async () => {
    const result = await service.exchangeAuthorizationCode(validInput());

    expect(result).toMatchObject({
      token_type: 'Bearer',
      expires_in: 600,
      scope: 'openid email profile',
    });
    expect(result.access_token.split('.')).toHaveLength(3);
    expect(result.id_token).toBeDefined();
    const idToken = result.id_token ?? '';

    expect(idToken.split('.')).toHaveLength(3);
    const idTokenPayload = decodeJwtPayload(idToken);

    expect(idTokenPayload).toMatchObject({
      iss: 'https://auth.company.com',
      aud: 'internal-web',
      sub: 'usr_123',
      exp: Math.floor(now.getTime() / 1000) + 900,
      iat: Math.floor(now.getTime() / 1000),
      auth_time: Math.floor(
        new Date('2026-06-21T11:55:00.000Z').getTime() / 1000,
      ),
      nonce: 'nonce_123',
      email: 'admin@company.com',
      email_verified: true,
      name: 'Internal Admin',
    });
    expect(codeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        consumedAt: now,
      }),
    );
    expect(codeRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        lock: {
          mode: 'pessimistic_write',
        },
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oidc.token.issued',
        severity: AuditSeverity.INFO,
        actorUserId: 'usr_123',
        clientId: 'cli_123',
      }),
    );
  });

  it('issues refresh tokens only when offline_access and client policy allow it', async () => {
    codeRepository.findOne.mockResolvedValueOnce({
      ...validCode(),
      scope: 'openid offline_access',
    });
    clientRepository.findOne.mockResolvedValueOnce({
      ...validClient(),
      allowRefreshTokens: true,
      refreshTokenIdleTtlSeconds: 600,
      refreshTokenAbsoluteTtlSeconds: 3600,
    });

    await expect(
      service.exchangeAuthorizationCode(validInput()),
    ).resolves.toMatchObject({
      refresh_token: 'issued-refresh-token',
    });

    expect(issueRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'usr_123',
        clientId: 'cli_123',
        providerSessionId: 'psn_123',
        idleTtlSeconds: 600,
        absoluteTtlSeconds: 3600,
        now,
      }),
    );

    issueRefreshToken.mockClear();
    codeRepository.findOne.mockResolvedValueOnce({
      ...validCode(),
      scope: 'openid',
    });

    await expect(
      service.exchangeAuthorizationCode(validInput()),
    ).resolves.not.toHaveProperty('refresh_token');
    expect(issueRefreshToken).not.toHaveBeenCalled();
  });

  it('rotates refresh tokens and returns a new access token', async () => {
    const result = await service.exchangeAuthorizationCode({
      grantType: 'refresh_token',
      refreshToken: 'presented-refresh-token',
      clientId: 'internal-web',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      now,
    });

    expect(result).toMatchObject({
      token_type: 'Bearer',
      expires_in: 600,
      refresh_token: 'rotated-refresh-token',
      scope: 'openid offline_access',
    });
    expect(result.access_token.split('.')).toHaveLength(3);
    expect(rotateTokenForClient).toHaveBeenCalledWith({
      refreshToken: 'presented-refresh-token',
      clientIdentifier: 'internal-web',
      clientSecret: undefined,
      now,
    });
  });

  it('revokes presented refresh tokens without returning token state', async () => {
    await expect(
      service.revokeToken({
        token: 'presented-refresh-token',
        now,
      }),
    ).resolves.toBeUndefined();

    expect(revokePresentedToken).toHaveBeenCalledWith({
      refreshToken: 'presented-refresh-token',
      reason: 'client_revocation',
      now,
    });
  });

  it('publishes the active signing key as JWKS', async () => {
    await service.exchangeAuthorizationCode(validInput());

    const savedSigningKey = signingRepository.save.mock.calls[0]?.[0] as object;
    signingRepository.findOne.mockResolvedValueOnce(savedSigningKey);

    const jwks = await service.jwks();

    expect(jwks.keys[0]?.kid).toEqual(expect.stringMatching(/^kid_/));
    expect(jwks.keys[0]?.alg).toBe('RS256');
    expect(jwks.keys[0]?.use).toBe('sig');
  });

  it('rejects unsupported grants', async () => {
    await expect(
      service.exchangeAuthorizationCode({
        ...validInput(),
        grantType: 'client_credentials',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid, consumed, and expired authorization codes', async () => {
    codeRepository.findOne.mockResolvedValueOnce(null);
    await expect(
      service.exchangeAuthorizationCode(validInput()),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    codeRepository.findOne.mockResolvedValueOnce({
      ...validCode(),
      consumedAt: now,
    });
    await expect(
      service.exchangeAuthorizationCode(validInput()),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    codeRepository.findOne.mockResolvedValueOnce({
      ...validCode(),
      expiresAt: new Date('2026-06-21T11:59:59.000Z'),
    });
    await expect(
      service.exchangeAuthorizationCode(validInput()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects wrong client, redirect URI, and PKCE verifier', async () => {
    clientRepository.findOne.mockResolvedValueOnce(null);
    await expect(
      service.exchangeAuthorizationCode(validInput()),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      service.exchangeAuthorizationCode({
        ...validInput(),
        redirectUri: 'https://evil.company.com/callback',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      service.exchangeAuthorizationCode({
        ...validInput(),
        codeVerifier: 'wrong',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects disabled clients, inactive users, and unauthenticated confidential clients', async () => {
    clientRepository.findOne.mockResolvedValueOnce({
      ...validClient(),
      status: OidcClientStatus.DISABLED,
    });
    await expect(
      service.exchangeAuthorizationCode(validInput()),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    userRepository.findOne.mockResolvedValueOnce({
      ...validUser(),
      status: UserStatus.SUSPENDED,
    });
    await expect(
      service.exchangeAuthorizationCode(validInput()),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    clientRepository.findOne.mockResolvedValueOnce({
      ...validClient(),
      type: OidcClientType.CONFIDENTIAL,
      clientSecretHash: createHash('sha256').update('secret').digest('hex'),
    });
    await expect(
      service.exchangeAuthorizationCode(validInput()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns userinfo claims constrained by scope and client allowed claims', async () => {
    const tokenResponse = await service.exchangeAuthorizationCode(validInput());
    const savedSigningKey = signingRepository.save.mock.calls[0]?.[0] as object;
    signingRepository.findOne.mockResolvedValueOnce(savedSigningKey);
    topLevelUserRepository.findOne.mockResolvedValueOnce(validUser());
    topLevelClientRepository.findOne.mockResolvedValueOnce(validClient());

    await expect(
      service.userInfo({
        authorizationHeader: `Bearer ${tokenResponse.access_token}`,
      }),
    ).resolves.toMatchObject({
      sub: 'usr_123',
      email: 'admin@company.com',
      email_verified: true,
      name: 'Internal Admin',
    });
  });

  function seedValidExchangeState(): void {
    codeRepository.findOne.mockResolvedValue(validCode());
    clientRepository.findOne.mockResolvedValue(validClient());
    userRepository.findOne.mockResolvedValue(validUser());
    signingRepository.findOne.mockResolvedValue(null);
  }

  function validInput() {
    return {
      grantType: 'authorization_code',
      code: 'raw-code',
      redirectUri: 'https://app.company.com/callback',
      clientId: 'internal-web',
      codeVerifier: 'verifier',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      now,
    };
  }

  function validCode() {
    return {
      id: 'cod_123',
      codeHash: createHash('sha256').update('raw-code').digest('hex'),
      clientId: 'cli_123',
      userId: 'usr_123',
      providerSessionId: 'psn_123',
      redirectUri: 'https://app.company.com/callback',
      scope: 'openid email profile',
      codeChallenge: createHash('sha256')
        .update('verifier')
        .digest('base64url'),
      nonce: 'nonce_123',
      authTime: new Date('2026-06-21T11:55:00.000Z'),
      expiresAt: new Date('2026-06-21T12:05:00.000Z'),
      consumedAt: null,
    };
  }

  function validClient() {
    return {
      id: 'cli_123',
      clientId: 'internal-web',
      type: OidcClientType.PUBLIC,
      status: OidcClientStatus.ACTIVE,
      clientSecretHash: null,
      accessTokenTtlSeconds: 600,
      idTokenTtlSeconds: 900,
      allowedClaims: ['email', 'name'],
      allowRefreshTokens: false,
      refreshTokenIdleTtlSeconds: null,
      refreshTokenAbsoluteTtlSeconds: null,
    };
  }

  function validUser() {
    return {
      id: 'usr_123',
      email: 'admin@company.com',
      emailVerifiedAt: new Date('2026-06-01T00:00:00.000Z'),
      displayName: 'Internal Admin',
      givenName: 'Internal',
      familyName: 'Admin',
      username: 'internal.admin',
      profileType: UserProfileType.EMPLOYEE,
      status: UserStatus.ACTIVE,
    };
  }
});

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');

  return JSON.parse(
    Buffer.from(payload ?? '', 'base64url').toString('utf8'),
  ) as Record<string, unknown>;
}
