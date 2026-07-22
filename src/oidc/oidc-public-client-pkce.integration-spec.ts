import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppConfigService } from '../config/app-config.service';
import { DATABASE_ENTITIES } from '../database/entities';
import { OidcAuthorizationCodeEntity } from '../database/entities/oidc-authorization-code.entity';
import {
  OidcClientEntity,
  OidcClientStatus,
  OidcClientType,
} from '../database/entities/oidc-client.entity';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { OidcRedirectUriEntity } from '../database/entities/oidc-redirect-uri.entity';
import { SigningKeyEntity } from '../database/entities/signing-key.entity';
import {
  UserEntity,
  UserProfileType,
  UserStatus,
} from '../database/entities/user.entity';
import { DATABASE_MIGRATIONS } from '../database/migrations';
import { RefreshTokenService } from '../tokens/refresh-token.service';
import { OidcAuthorizationService } from './oidc-authorization.service';
import { OidcTokenService } from './oidc-token.service';

const integrationDatabaseUrl =
  process.env.INTERNAL_ID_INTEGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

const describeWithDatabase = integrationDatabaseUrl ? describe : describe.skip;

describeWithDatabase('Public client PKCE flow integration', () => {
  let dataSource: DataSource;
  let authorizationService: OidcAuthorizationService;
  let tokenService: OidcTokenService;

  const configService = {
    get: (key: string) => {
      if (key === 'app.baseUrl') {
        return 'https://auth.company.com';
      }

      if (key === 'betterAuth.secret') {
        // Must match whatever secret already encrypted an ACTIVE signing key
        // in this database, if one exists.
        return process.env.BETTER_AUTH_SECRET ?? 'integration-test-secret';
      }

      if (key === 'betterAuth.loginPath') {
        return '/admin/login';
      }

      throw new Error(`Unexpected config key: ${key}`);
    },
  } as unknown as AppConfigService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: integrationDatabaseUrl,
      entities: [...DATABASE_ENTITIES],
      migrations: [...DATABASE_MIGRATIONS],
      migrationsTableName: 'typeorm_migrations',
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await cleanupIntegrationRows(dataSource);
    await seedUserClientAndSession(dataSource);

    const auditService = { record: vi.fn(() => Promise.resolve('evt_it')) };
    authorizationService = new OidcAuthorizationService(
      configService,
      dataSource.getRepository(OidcClientEntity),
      dataSource.getRepository(OidcRedirectUriEntity),
      dataSource.getRepository(OidcProviderSessionEntity),
      dataSource.getRepository(UserEntity),
      dataSource.getRepository(OidcAuthorizationCodeEntity),
      auditService as never,
    );
    const refreshTokenService = new RefreshTokenService(
      dataSource.getRepository(OidcClientEntity),
      dataSource,
      auditService as never,
      configService,
    );
    tokenService = new OidcTokenService(
      configService,
      dataSource,
      dataSource.getRepository(SigningKeyEntity),
      dataSource.getRepository(UserEntity),
      dataSource.getRepository(OidcClientEntity),
      auditService as never,
      refreshTokenService,
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await cleanupIntegrationRows(dataSource);
      await dataSource.destroy();
    }
  });

  it('completes authorize -> token for a public client using PKCE, without a client_secret', async () => {
    const verifier = 'integration-test-code-verifier-1234567890';
    const challenge = s256Challenge(verifier);

    const authorizeResult = await authorizationService.authorize({
      responseType: 'code',
      clientId: integrationClientIdentifier,
      redirectUri: integrationRedirectUri,
      scope: 'openid email',
      state: 'state_123',
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
      providerSessionToken: integrationSessionToken,
      originalUrl: '/oauth/authorize',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });

    const code = new URL(authorizeResult.redirectTo).searchParams.get('code');
    expect(code).toBeTruthy();

    const tokenResponse = await tokenService.exchangeAuthorizationCode({
      grantType: 'authorization_code',
      code: code ?? '',
      redirectUri: integrationRedirectUri,
      clientId: integrationClientIdentifier,
      codeVerifier: verifier,
      // No clientSecret: public clients authenticate via PKCE alone.
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(tokenResponse.token_type).toBe('Bearer');
    expect(tokenResponse.access_token.split('.')).toHaveLength(3);
    expect(tokenResponse.id_token?.split('.')).toHaveLength(3);
  });

  it('rejects a token exchange with the wrong code_verifier', async () => {
    const challenge = s256Challenge('correct-verifier-1234567890');

    const authorizeResult = await authorizationService.authorize({
      responseType: 'code',
      clientId: integrationClientIdentifier,
      redirectUri: integrationRedirectUri,
      scope: 'openid',
      state: 'state_123',
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
      providerSessionToken: integrationSessionToken,
      originalUrl: '/oauth/authorize',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
    const code = new URL(authorizeResult.redirectTo).searchParams.get('code');

    await expect(
      tokenService.exchangeAuthorizationCode({
        grantType: 'authorization_code',
        code: code ?? '',
        redirectUri: integrationRedirectUri,
        clientId: integrationClientIdentifier,
        codeVerifier: 'wrong-verifier',
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects replaying an already-consumed authorization code', async () => {
    const verifier = 'reused-code-verifier-1234567890';
    const challenge = s256Challenge(verifier);

    const authorizeResult = await authorizationService.authorize({
      responseType: 'code',
      clientId: integrationClientIdentifier,
      redirectUri: integrationRedirectUri,
      scope: 'openid',
      state: 'state_123',
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
      providerSessionToken: integrationSessionToken,
      originalUrl: '/oauth/authorize',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
    const code = new URL(authorizeResult.redirectTo).searchParams.get('code');
    const exchange = () =>
      tokenService.exchangeAuthorizationCode({
        grantType: 'authorization_code',
        code: code ?? '',
        redirectUri: integrationRedirectUri,
        clientId: integrationClientIdentifier,
        codeVerifier: verifier,
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      });

    await expect(exchange()).resolves.toMatchObject({ token_type: 'Bearer' });
    await expect(exchange()).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

const integrationUserId = 'usr_it_pkce';
const integrationClientId = 'cli_it_pkce';
const integrationClientIdentifier = 'internal-id-integration-pkce-client';
const integrationRedirectUri = 'https://app.company.com/callback';
const integrationSessionId = 'psn_it_pkce';
const integrationSessionToken = 'integration-provider-session-token';

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function s256Challenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

async function cleanupIntegrationRows(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    await manager
      .createQueryBuilder()
      .delete()
      .from(OidcAuthorizationCodeEntity)
      .where('client_id = :clientId', { clientId: integrationClientId })
      .execute();
    await manager.delete(OidcProviderSessionEntity, {
      id: integrationSessionId,
    });
    await manager.delete(OidcRedirectUriEntity, {
      clientId: integrationClientId,
    });
    await manager.delete(OidcClientEntity, { id: integrationClientId });
    await manager.delete(UserEntity, { id: integrationUserId });
  });
}

async function seedUserClientAndSession(dataSource: DataSource): Promise<void> {
  const now = new Date();

  await dataSource.transaction(async (manager) => {
    await manager.save(
      manager.create(UserEntity, {
        id: integrationUserId,
        email: 'pkce-integration@company.com',
        normalizedEmail: 'pkce-integration@company.com',
        emailVerifiedAt: null,
        username: 'pkce.integration',
        normalizedUsername: 'pkce.integration',
        displayName: 'PKCE Integration',
        givenName: 'PKCE',
        familyName: 'Integration',
        profileType: UserProfileType.EMPLOYEE,
        status: UserStatus.ACTIVE,
        deactivatedAt: null,
      }),
    );
    await manager.save(
      manager.create(OidcClientEntity, {
        id: integrationClientId,
        clientId: integrationClientIdentifier,
        clientSecretHash: null,
        name: 'PKCE Integration Client',
        type: OidcClientType.PUBLIC,
        status: OidcClientStatus.ACTIVE,
        allowedScopes: ['openid', 'email', 'offline_access'],
        allowedClaims: ['email'],
        requirePkce: true,
        allowRefreshTokens: false,
        accessTokenTtlSeconds: 600,
        idTokenTtlSeconds: 900,
        refreshTokenIdleTtlSeconds: null,
        refreshTokenAbsoluteTtlSeconds: null,
        ownerTeam: 'identity',
      }),
    );
    await manager.save(
      manager.create(OidcRedirectUriEntity, {
        id: 'rdu_it_pkce',
        clientId: integrationClientId,
        uri: integrationRedirectUri,
      }),
    );
    await manager.save(
      manager.create(OidcProviderSessionEntity, {
        id: integrationSessionId,
        userId: integrationUserId,
        sessionHash: hashSecret(integrationSessionToken),
        lastSeenAt: now,
        authTime: now,
        idleExpiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        absoluteExpiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        revokedAt: null,
        revocationReason: null,
        ipAddress: null,
        userAgent: null,
      }),
    );
  });
}
