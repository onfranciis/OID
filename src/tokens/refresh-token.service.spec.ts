import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import {
  OidcClientStatus,
  OidcClientType,
} from '../database/entities/oidc-client.entity';
import { OidcRefreshTokenEntity } from '../database/entities/oidc-refresh-token.entity';
import { UserStatus } from '../database/entities/user.entity';
import { RefreshTokenService } from './refresh-token.service';

describe('RefreshTokenService', () => {
  it('issues a hashed refresh token with a new family id', async () => {
    const auditRecord = vi.fn(() => Promise.resolve('evt_123'));
    const savedEntities: OidcRefreshTokenEntity[] = [];
    const service = new RefreshTokenService(
      {} as never,
      {} as never,
      createDataSourceStub({
        save: (entity) => {
          savedEntities.push(entity as OidcRefreshTokenEntity);
          return Promise.resolve(entity);
        },
      }) as never,
      {
        record: auditRecord,
      } as never,
      {
        get: () => 'test-better-auth-secret',
      } as never,
    );

    const result = await service.issueToken({
      userId: 'usr_123',
      clientId: 'cli_123',
      providerSessionId: 'pss_123',
      idleTtlSeconds: 600,
      absoluteTtlSeconds: 3600,
      now: new Date('2026-06-11T00:00:00.000Z'),
    });

    expect(result.refreshToken).toHaveLength(43);
    expect(result.familyId).toMatch(/^rtf_/);
    expect(savedEntities[0]?.tokenHash).not.toBe(result.refreshToken);
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oidc.refresh_token.rotated',
        severity: AuditSeverity.INFO,
      }),
    );
  });

  it('rotates a valid refresh token and links parent to successor', async () => {
    const currentToken = createRefreshTokenEntity();
    const savedEntities: OidcRefreshTokenEntity[] = [];
    const auditRecord = vi.fn(() => Promise.resolve('evt_123'));
    const findOne = vi.fn(() => Promise.resolve(currentToken));
    const service = new RefreshTokenService(
      {} as never,
      {} as never,
      createDataSourceStub({
        findOne,
        save: (entity) => {
          if (Array.isArray(entity)) {
            savedEntities.push(...entity);
          } else {
            savedEntities.push(entity);
          }

          return Promise.resolve(entity);
        },
      }) as never,
      {
        record: auditRecord,
      } as never,
      {
        get: () => 'test-better-auth-secret',
      } as never,
    );

    const result = await service.rotateToken({
      refreshToken: 'presented-token',
      idleTtlSeconds: 600,
      absoluteTtlSeconds: 3600,
      now: new Date('2026-06-11T00:05:00.000Z'),
    });

    const successor = savedEntities.find(
      (entity) => entity.id === result.tokenId,
    );
    expect(successor?.parentTokenId).toBe(currentToken.id);
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        lock: {
          mode: 'pessimistic_write',
        },
      }),
    );
    expect(currentToken.rotatedToTokenId).toBe(result.tokenId);
    expect(currentToken.revocationReason).toBe('rotated');
    expect(result.familyId).toBe(currentToken.familyId);
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oidc.refresh_token.rotated',
        severity: AuditSeverity.INFO,
      }),
    );
  });

  it('revokes the whole family and emits a critical audit event on replay', async () => {
    const replayedToken = createRefreshTokenEntity({
      rotatedToTokenId: 'rtk_successor',
    });
    const familyMembers = [
      replayedToken,
      createRefreshTokenEntity({
        id: 'rtk_sibling',
        familyId: replayedToken.familyId,
      }),
    ];
    const auditRecord = vi.fn(() => Promise.resolve('evt_123'));
    const service = new RefreshTokenService(
      {} as never,
      {} as never,
      createDataSourceStub({
        findOne: () => Promise.resolve(replayedToken),
        find: () => Promise.resolve(familyMembers),
        save: (entity) => Promise.resolve(entity),
      }) as never,
      {
        record: auditRecord,
      } as never,
      {
        get: () => 'test-better-auth-secret',
      } as never,
    );

    await expect(
      service.rotateToken({
        refreshToken: 'replayed-token',
        idleTtlSeconds: 600,
        absoluteTtlSeconds: 3600,
        now: new Date('2026-06-11T00:05:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(
      familyMembers.every(
        (token) => token.revocationReason === 'replay_detected',
      ),
    ).toBe(true);
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oidc.refresh_token.replay_detected',
        severity: AuditSeverity.CRITICAL,
      }),
    );
  });

  it('rejects expired refresh tokens', async () => {
    const expiredToken = createRefreshTokenEntity({
      idleExpiresAt: new Date('2026-06-11T00:00:00.000Z'),
    });
    const service = new RefreshTokenService(
      {} as never,
      {} as never,
      createDataSourceStub({
        findOne: () => Promise.resolve(expiredToken),
      }) as never,
      {
        record: vi.fn(() => Promise.resolve('evt_123')),
      } as never,
      {
        get: () => 'test-better-auth-secret',
      } as never,
    );

    await expect(
      service.rotateToken({
        refreshToken: 'expired-token',
        idleTtlSeconds: 600,
        absoluteTtlSeconds: 3600,
        now: new Date('2026-06-11T01:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates refresh tokens only for active clients and active users', async () => {
    const currentToken = createRefreshTokenEntity();
    const savedEntities: OidcRefreshTokenEntity[] = [];
    const service = new RefreshTokenService(
      {} as never,
      {} as never,
      createDataSourceStub({
        findOne: (criteria) => {
          if (isRefreshTokenLookup(criteria)) {
            return Promise.resolve(currentToken);
          }

          return Promise.resolve(null);
        },
        findClient: () =>
          Promise.resolve({
            id: 'cli_123',
            clientId: 'internal-web',
            type: OidcClientType.PUBLIC,
            status: OidcClientStatus.ACTIVE,
            allowRefreshTokens: true,
            refreshTokenIdleTtlSeconds: 600,
            refreshTokenAbsoluteTtlSeconds: 3600,
            accessTokenTtlSeconds: 600,
            idTokenTtlSeconds: 900,
            allowedClaims: ['email'],
          }),
        findUser: () =>
          Promise.resolve({
            id: 'usr_123',
            status: UserStatus.ACTIVE,
          }),
        save: (entity) => {
          if (Array.isArray(entity)) {
            savedEntities.push(...entity);
          } else {
            savedEntities.push(entity);
          }

          return Promise.resolve(entity);
        },
      }) as never,
      {
        record: vi.fn(() => Promise.resolve('evt_123')),
      } as never,
      {
        get: () => 'test-better-auth-secret',
      } as never,
    );

    const result = await service.rotateTokenForClient({
      refreshToken: 'presented-token',
      clientIdentifier: 'internal-web',
      now: new Date('2026-06-11T00:05:00.000Z'),
    });

    expect(result.refreshToken).toHaveLength(43);
    expect(result.client.clientId).toBe('internal-web');
    expect(
      savedEntities.some((entity) => entity.parentTokenId === currentToken.id),
    ).toBe(true);
  });

  it('rejects disabled clients and inactive users during refresh rotation', async () => {
    const currentToken = createRefreshTokenEntity();
    const serviceWithDisabledClient = new RefreshTokenService(
      {} as never,
      {} as never,
      createDataSourceStub({
        findOne: () => Promise.resolve(currentToken),
        findClient: () =>
          Promise.resolve({
            id: 'cli_123',
            clientId: 'internal-web',
            type: OidcClientType.PUBLIC,
            status: OidcClientStatus.DISABLED,
            allowRefreshTokens: true,
            refreshTokenIdleTtlSeconds: 600,
            refreshTokenAbsoluteTtlSeconds: 3600,
          }),
      }) as never,
      {
        record: vi.fn(() => Promise.resolve('evt_123')),
      } as never,
      {
        get: () => 'test-better-auth-secret',
      } as never,
    );

    await expect(
      serviceWithDisabledClient.rotateTokenForClient({
        refreshToken: 'presented-token',
        clientIdentifier: 'internal-web',
        now: new Date('2026-06-11T00:05:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const serviceWithInactiveUser = new RefreshTokenService(
      {} as never,
      {} as never,
      createDataSourceStub({
        findOne: () => Promise.resolve(currentToken),
        findClient: () =>
          Promise.resolve({
            id: 'cli_123',
            clientId: 'internal-web',
            type: OidcClientType.PUBLIC,
            status: OidcClientStatus.ACTIVE,
            allowRefreshTokens: true,
            refreshTokenIdleTtlSeconds: 600,
            refreshTokenAbsoluteTtlSeconds: 3600,
          }),
        findUser: () =>
          Promise.resolve({
            id: 'usr_123',
            status: UserStatus.SUSPENDED,
          }),
      }) as never,
      {
        record: vi.fn(() => Promise.resolve('evt_123')),
      } as never,
      {
        get: () => 'test-better-auth-secret',
      } as never,
    );

    await expect(
      serviceWithInactiveUser.rotateTokenForClient({
        refreshToken: 'presented-token',
        clientIdentifier: 'internal-web',
        now: new Date('2026-06-11T00:05:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns success for unknown revocation tokens without disclosure', async () => {
    const auditRecord = vi.fn(() => Promise.resolve('evt_123'));
    const service = new RefreshTokenService(
      {} as never,
      {} as never,
      createDataSourceStub({
        findOne: () => Promise.resolve(null),
      }) as never,
      {
        record: auditRecord,
      } as never,
      {
        get: () => 'test-better-auth-secret',
      } as never,
    );

    await expect(
      service.revokePresentedToken({
        refreshToken: 'unknown-token',
        reason: 'client_revocation',
      }),
    ).resolves.toBeUndefined();

    expect(auditRecord).not.toHaveBeenCalled();
  });
});

function createDataSourceStub(repositoryBehavior: {
  findOne?: (criteria: unknown) => Promise<OidcRefreshTokenEntity | null>;
  find?: (criteria: unknown) => Promise<OidcRefreshTokenEntity[]>;
  findClient?: (criteria: unknown) => Promise<unknown>;
  findUser?: (criteria: unknown) => Promise<unknown>;
  save?: (
    entity: OidcRefreshTokenEntity | OidcRefreshTokenEntity[],
  ) => Promise<unknown>;
}) {
  return {
    transaction: async (
      runInTransaction: (manager: {
        create: (
          _: typeof OidcRefreshTokenEntity,
          input: Partial<OidcRefreshTokenEntity>,
        ) => OidcRefreshTokenEntity;
        save: (
          entity: OidcRefreshTokenEntity | OidcRefreshTokenEntity[],
        ) => Promise<unknown>;
        getRepository: (_: typeof OidcRefreshTokenEntity) => {
          create: (
            input: Partial<OidcRefreshTokenEntity>,
          ) => OidcRefreshTokenEntity;
          findOne: (
            criteria: unknown,
          ) => Promise<OidcRefreshTokenEntity | null>;
          find: (criteria: unknown) => Promise<OidcRefreshTokenEntity[]>;
          save: (
            entity: OidcRefreshTokenEntity | OidcRefreshTokenEntity[],
          ) => Promise<unknown>;
        };
      }) => Promise<unknown>,
    ) =>
      runInTransaction({
        create: (_entity, input) =>
          Object.assign(new OidcRefreshTokenEntity(), input),
        save: async (entity) => repositoryBehavior.save?.(entity) ?? entity,
        getRepository: (entity) => {
          if (entity.name === 'OidcClientEntity') {
            return {
              findOne: async (criteria: unknown) =>
                repositoryBehavior.findClient?.(criteria) ?? null,
            } as never;
          }

          if (entity.name === 'UserEntity') {
            return {
              findOne: async (criteria: unknown) =>
                repositoryBehavior.findUser?.(criteria) ?? null,
            } as never;
          }

          return {
            create: (input) =>
              Object.assign(new OidcRefreshTokenEntity(), input),
            findOne: async (criteria) =>
              repositoryBehavior.findOne?.(criteria) ?? null,
            find: async (criteria) => repositoryBehavior.find?.(criteria) ?? [],
            save: async (entity) => repositoryBehavior.save?.(entity) ?? entity,
          };
        },
      }),
  };
}

function isRefreshTokenLookup(criteria: unknown): boolean {
  return (
    typeof criteria === 'object' &&
    criteria !== null &&
    'where' in criteria &&
    typeof (criteria as { where?: unknown }).where === 'object' &&
    (criteria as { where?: { tokenHash?: unknown } }).where?.tokenHash !==
      undefined
  );
}

function createRefreshTokenEntity(
  overrides: Partial<OidcRefreshTokenEntity> = {},
): OidcRefreshTokenEntity {
  return Object.assign(new OidcRefreshTokenEntity(), {
    id: 'rtk_current',
    tokenHash:
      '4d6ca34686ad2028d9230d60a8911f7774d5fe9d3d7df9ee8f11cad530f1f2f0',
    userId: 'usr_123',
    clientId: 'cli_123',
    providerSessionId: 'pss_123',
    parentTokenId: null,
    rotatedToTokenId: null,
    familyId: 'rtf_family',
    issuedAt: new Date('2026-06-11T00:00:00.000Z'),
    lastUsedAt: null,
    idleExpiresAt: new Date('2026-06-11T00:30:00.000Z'),
    absoluteExpiresAt: new Date('2026-06-11T01:00:00.000Z'),
    revokedAt: null,
    revocationReason: null,
    ...overrides,
  });
}
