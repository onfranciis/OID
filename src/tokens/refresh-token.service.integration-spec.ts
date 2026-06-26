import { ConflictException } from '@nestjs/common';
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
import { AuditEventTypes } from '../audit/audit.types';
import { DATABASE_ENTITIES } from '../database/entities';
import {
  OidcClientEntity,
  OidcClientStatus,
  OidcClientType,
} from '../database/entities/oidc-client.entity';
import { OidcRefreshTokenEntity } from '../database/entities/oidc-refresh-token.entity';
import {
  UserEntity,
  UserProfileType,
  UserStatus,
} from '../database/entities/user.entity';
import { DATABASE_MIGRATIONS } from '../database/migrations';
import { RefreshTokenService } from './refresh-token.service';

const integrationDatabaseUrl =
  process.env.INTERNAL_ID_INTEGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

const describeWithDatabase = integrationDatabaseUrl ? describe : describe.skip;

describeWithDatabase('RefreshTokenService integration', () => {
  let dataSource: DataSource;
  let service: RefreshTokenService;
  let auditRecord: ReturnType<typeof vi.fn>;

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
    auditRecord = vi.fn(() => Promise.resolve('evt_integration'));
    service = new RefreshTokenService(
      dataSource.getRepository(OidcClientEntity),
      dataSource,
      {
        record: auditRecord,
      } as never,
      {
        get: () => 'integration-better-auth-secret',
      } as never,
    );

    await cleanupIntegrationRows(dataSource);
    await seedUserAndClient(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await cleanupIntegrationRows(dataSource);
      await dataSource.destroy();
    }
  });

  it('rotates a refresh token and persists the parent-successor link', async () => {
    const issued = await service.issueToken({
      userId: integrationUserId,
      clientId: integrationClientId,
      providerSessionId: null,
      idleTtlSeconds: 600,
      absoluteTtlSeconds: 3600,
      now: new Date('2026-06-11T00:00:00.000Z'),
    });

    const rotated = await service.rotateToken({
      refreshToken: issued.refreshToken,
      idleTtlSeconds: 600,
      absoluteTtlSeconds: 3600,
      now: new Date('2026-06-11T00:05:00.000Z'),
    });

    const repository = dataSource.getRepository(OidcRefreshTokenEntity);
    const parent = await repository.findOneByOrFail({ id: issued.tokenId });
    const successor = await repository.findOneByOrFail({ id: rotated.tokenId });

    expect(parent.rotatedToTokenId).toBe(successor.id);
    expect(parent.revokedAt).toEqual(new Date('2026-06-11T00:05:00.000Z'));
    expect(parent.revocationReason).toBe('rotated');
    expect(successor.parentTokenId).toBe(parent.id);
    expect(successor.familyId).toBe(parent.familyId);
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventTypes.OidcRefreshTokenRotated,
      }),
    );
  });

  it('allows only one concurrent rotation of the same refresh token', async () => {
    const issued = await service.issueToken({
      userId: integrationUserId,
      clientId: integrationClientId,
      providerSessionId: null,
      idleTtlSeconds: 600,
      absoluteTtlSeconds: 3600,
      now: new Date('2026-06-11T00:00:00.000Z'),
    });

    const attempts = await Promise.allSettled([
      service.rotateToken({
        refreshToken: issued.refreshToken,
        idleTtlSeconds: 600,
        absoluteTtlSeconds: 3600,
        now: new Date('2026-06-11T00:05:00.000Z'),
      }),
      service.rotateToken({
        refreshToken: issued.refreshToken,
        idleTtlSeconds: 600,
        absoluteTtlSeconds: 3600,
        now: new Date('2026-06-11T00:05:01.000Z'),
      }),
    ]);

    const fulfilled = attempts.filter(
      (attempt) => attempt.status === 'fulfilled',
    );
    const rejected = attempts.filter(
      (attempt) => attempt.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(ConflictException);

    const familyTokens = await dataSource
      .getRepository(OidcRefreshTokenEntity)
      .find({
        where: {
          familyId: issued.familyId,
        },
        order: {
          issuedAt: 'ASC',
        },
      });

    expect(familyTokens).toHaveLength(2);
    expect(familyTokens.every((token) => token.revokedAt)).toBe(true);
    expect(
      familyTokens.some(
        (token) => token.revocationReason === 'replay_detected',
      ),
    ).toBe(true);
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventTypes.OidcRefreshTokenReplayDetected,
      }),
    );
  });

  it('revokes the token family when a rotated token is replayed', async () => {
    const issued = await service.issueToken({
      userId: integrationUserId,
      clientId: integrationClientId,
      providerSessionId: null,
      idleTtlSeconds: 600,
      absoluteTtlSeconds: 3600,
      now: new Date('2026-06-11T00:00:00.000Z'),
    });

    const rotated = await service.rotateToken({
      refreshToken: issued.refreshToken,
      idleTtlSeconds: 600,
      absoluteTtlSeconds: 3600,
      now: new Date('2026-06-11T00:05:00.000Z'),
    });

    await expect(
      service.rotateToken({
        refreshToken: issued.refreshToken,
        idleTtlSeconds: 600,
        absoluteTtlSeconds: 3600,
        now: new Date('2026-06-11T00:06:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const familyTokens = await dataSource
      .getRepository(OidcRefreshTokenEntity)
      .findBy({
        familyId: issued.familyId,
      });
    const successor = familyTokens.find(
      (token) => token.id === rotated.tokenId,
    );

    expect(familyTokens).toHaveLength(2);
    expect(familyTokens.every((token) => token.revokedAt)).toBe(true);
    expect(successor?.revocationReason).toBe('replay_detected');
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventTypes.OidcRefreshTokenReplayDetected,
      }),
    );
  });
});

const integrationUserId = 'usr_it_refresh_token';
const integrationClientId = 'cli_it_refresh_token';

async function cleanupIntegrationRows(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    await manager
      .createQueryBuilder()
      .delete()
      .from(OidcRefreshTokenEntity)
      .where('user_id = :userId OR client_id = :clientId', {
        userId: integrationUserId,
        clientId: integrationClientId,
      })
      .execute();
    await manager.delete(OidcClientEntity, { id: integrationClientId });
    await manager.delete(UserEntity, { id: integrationUserId });
  });
}

async function seedUserAndClient(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    await manager.save(
      manager.create(UserEntity, {
        id: integrationUserId,
        email: 'refresh-token-integration@company.com',
        normalizedEmail: 'refresh-token-integration@company.com',
        emailVerifiedAt: new Date('2026-06-11T00:00:00.000Z'),
        username: 'refresh.token.integration',
        normalizedUsername: 'refresh.token.integration',
        displayName: 'Refresh Token Integration',
        givenName: 'Refresh',
        familyName: 'Integration',
        profileType: UserProfileType.EMPLOYEE,
        status: UserStatus.ACTIVE,
        deactivatedAt: null,
      }),
    );
    await manager.save(
      manager.create(OidcClientEntity, {
        id: integrationClientId,
        clientId: 'refresh-token-integration-client',
        clientSecretHash: null,
        name: 'Refresh Token Integration Client',
        type: OidcClientType.PUBLIC,
        status: OidcClientStatus.ACTIVE,
        allowedScopes: ['openid', 'offline_access'],
        allowedClaims: ['email'],
        requirePkce: true,
        allowRefreshTokens: true,
        accessTokenTtlSeconds: 600,
        idTokenTtlSeconds: 900,
        refreshTokenIdleTtlSeconds: 600,
        refreshTokenAbsoluteTtlSeconds: 3600,
        ownerTeam: 'identity',
      }),
    );
  });
}
