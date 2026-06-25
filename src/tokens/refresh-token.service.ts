import {
  ConflictException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { ulid } from 'ulid';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditEventTypes } from '../audit/audit.types';
import { AppConfigService } from '../config/app-config.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import {
  OidcClientEntity,
  OidcClientStatus,
  OidcClientType,
} from '../database/entities/oidc-client.entity';
import { OidcRefreshTokenEntity } from '../database/entities/oidc-refresh-token.entity';
import { UserEntity, UserStatus } from '../database/entities/user.entity';
import type {
  IssueRefreshTokenForClientInput,
  IssueRefreshTokenInput,
  IssueRefreshTokenResult,
  ResolveRefreshGrantResult,
  RotateRefreshTokenForClientInput,
  RotateRefreshTokenForClientResult,
  RotateRefreshTokenInput,
  RevokePresentedRefreshTokenInput,
} from './refresh-token.types';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(OidcClientEntity)
    private readonly clientRepository: Repository<OidcClientEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly configService: AppConfigService,
  ) {}

  async issueTokenForClient(
    input: IssueRefreshTokenForClientInput,
  ): Promise<IssueRefreshTokenResult | null> {
    const client = await this.clientRepository.findOne({
      where: {
        clientId: input.clientIdentifier,
        status: OidcClientStatus.ACTIVE,
      },
    });

    if (!client) {
      throw new NotFoundException('OIDC client not found.');
    }

    if (
      !client.allowRefreshTokens ||
      !client.refreshTokenIdleTtlSeconds ||
      !client.refreshTokenAbsoluteTtlSeconds
    ) {
      return null;
    }

    return this.issueToken({
      userId: input.userId,
      clientId: client.id,
      providerSessionId: input.providerSessionId ?? null,
      idleTtlSeconds: client.refreshTokenIdleTtlSeconds,
      absoluteTtlSeconds: client.refreshTokenAbsoluteTtlSeconds,
      upstreamRefreshToken: input.upstreamRefreshToken,
      now: input.now,
    });
  }

  async issueToken(
    input: IssueRefreshTokenInput,
  ): Promise<IssueRefreshTokenResult> {
    return this.dataSource.transaction(async (manager) => {
      const now = input.now ?? new Date();
      const rawRefreshToken = generateOpaqueRefreshToken();
      const tokenId = `rtk_${ulid().toLowerCase()}`;
      const familyId = `rtf_${ulid().toLowerCase()}`;
      const entity = manager.create(OidcRefreshTokenEntity, {
        id: tokenId,
        tokenHash: hashRefreshToken(rawRefreshToken),
        upstreamRefreshTokenCiphertext: input.upstreamRefreshToken
          ? this.encryptUpstreamRefreshToken(input.upstreamRefreshToken)
          : null,
        userId: input.userId,
        clientId: input.clientId,
        providerSessionId: input.providerSessionId ?? null,
        parentTokenId: null,
        rotatedToTokenId: null,
        familyId,
        issuedAt: now,
        lastUsedAt: null,
        idleExpiresAt: addSeconds(now, input.idleTtlSeconds),
        absoluteExpiresAt: addSeconds(now, input.absoluteTtlSeconds),
        revokedAt: null,
        revocationReason: null,
      });

      await manager.save(entity);
      await this.auditService.record({
        eventType: AuditEventTypes.OidcRefreshTokenRotated,
        severity: AuditSeverity.INFO,
        actorUserId: input.userId,
        clientId: input.clientId,
        providerSessionId: input.providerSessionId ?? null,
        metadata: {
          tokenId,
          familyId,
          issuedVia: 'initial_issue',
        },
      });

      return {
        refreshToken: rawRefreshToken,
        tokenId,
        familyId,
        idleExpiresAt: entity.idleExpiresAt,
        absoluteExpiresAt: entity.absoluteExpiresAt,
      };
    });
  }

  async resolveRefreshGrant(
    refreshToken: string,
    now = new Date(),
  ): Promise<ResolveRefreshGrantResult> {
    const token = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(OidcRefreshTokenEntity);
      const currentToken = await repository.findOne({
        where: {
          tokenHash: hashRefreshToken(refreshToken),
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!currentToken) {
        throw new UnauthorizedException('Invalid refresh token.');
      }

      if (currentToken.rotatedToTokenId) {
        await this.revokeFamily(
          repository,
          currentToken.familyId,
          now,
          'replay_detected',
        );
        await this.auditService.record({
          eventType: AuditEventTypes.OidcRefreshTokenReplayDetected,
          severity: AuditSeverity.CRITICAL,
          actorUserId: currentToken.userId,
          clientId: currentToken.clientId,
          providerSessionId: currentToken.providerSessionId,
          metadata: {
            tokenId: currentToken.id,
            familyId: currentToken.familyId,
          },
        });
        throw new ConflictException(
          'Refresh token replay detected. Token family revoked.',
        );
      }

      assertTokenIsUsable(currentToken, now);
      return currentToken;
    });

    if (!token.upstreamRefreshTokenCiphertext) {
      throw new InternalServerErrorException(
        'Refresh token is missing upstream mapping.',
      );
    }

    return {
      upstreamRefreshToken: this.decryptUpstreamRefreshToken(
        token.upstreamRefreshTokenCiphertext,
      ),
      token: {
        id: token.id,
        familyId: token.familyId,
        userId: token.userId,
        clientId: token.clientId,
        providerSessionId: token.providerSessionId,
      },
    };
  }

  async rotateToken(
    input: RotateRefreshTokenInput,
  ): Promise<IssueRefreshTokenResult> {
    return this.dataSource.transaction(async (manager) => {
      const now = input.now ?? new Date();
      const repository = manager.getRepository(OidcRefreshTokenEntity);
      const currentToken = await repository.findOne({
        where: {
          tokenHash: hashRefreshToken(input.refreshToken),
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!currentToken) {
        throw new UnauthorizedException('Invalid refresh token.');
      }

      if (currentToken.rotatedToTokenId) {
        await this.revokeFamily(
          repository,
          currentToken.familyId,
          now,
          'replay_detected',
        );
        await this.auditService.record({
          eventType: AuditEventTypes.OidcRefreshTokenReplayDetected,
          severity: AuditSeverity.CRITICAL,
          actorUserId: currentToken.userId,
          clientId: currentToken.clientId,
          providerSessionId: currentToken.providerSessionId,
          metadata: {
            tokenId: currentToken.id,
            familyId: currentToken.familyId,
          },
        });
        throw new ConflictException(
          'Refresh token replay detected. Token family revoked.',
        );
      }

      assertTokenIsUsable(currentToken, now);

      const successorRawToken = generateOpaqueRefreshToken();
      const successorId = `rtk_${ulid().toLowerCase()}`;
      const successor = repository.create({
        id: successorId,
        tokenHash: hashRefreshToken(successorRawToken),
        upstreamRefreshTokenCiphertext: input.upstreamRefreshToken
          ? this.encryptUpstreamRefreshToken(input.upstreamRefreshToken)
          : currentToken.upstreamRefreshTokenCiphertext,
        userId: currentToken.userId,
        clientId: currentToken.clientId,
        providerSessionId: currentToken.providerSessionId,
        parentTokenId: currentToken.id,
        rotatedToTokenId: null,
        familyId: currentToken.familyId,
        issuedAt: now,
        lastUsedAt: null,
        idleExpiresAt: addSeconds(now, input.idleTtlSeconds),
        absoluteExpiresAt: addSeconds(
          currentToken.issuedAt,
          input.absoluteTtlSeconds,
        ),
        revokedAt: null,
        revocationReason: null,
      });

      currentToken.lastUsedAt = now;
      currentToken.rotatedToTokenId = successorId;
      currentToken.revokedAt = now;
      currentToken.revocationReason = 'rotated';

      await repository.save(successor);
      await repository.save(currentToken);
      await this.auditService.record({
        eventType: AuditEventTypes.OidcRefreshTokenRotated,
        severity: AuditSeverity.INFO,
        actorUserId: currentToken.userId,
        clientId: currentToken.clientId,
        providerSessionId: currentToken.providerSessionId,
        metadata: {
          tokenId: currentToken.id,
          successorTokenId: successorId,
          familyId: currentToken.familyId,
        },
      });

      return {
        refreshToken: successorRawToken,
        tokenId: successorId,
        familyId: currentToken.familyId,
        idleExpiresAt: successor.idleExpiresAt,
        absoluteExpiresAt: successor.absoluteExpiresAt,
      };
    });
  }

  async rotateTokenForClient(
    input: RotateRefreshTokenForClientInput,
  ): Promise<RotateRefreshTokenForClientResult> {
    return this.dataSource.transaction(async (manager) => {
      const now = input.now ?? new Date();
      const repository = manager.getRepository(OidcRefreshTokenEntity);
      const currentToken = await repository.findOne({
        where: {
          tokenHash: hashRefreshToken(input.refreshToken),
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!currentToken) {
        throw new UnauthorizedException('Invalid refresh token.');
      }

      if (currentToken.rotatedToTokenId) {
        await this.revokeFamily(
          repository,
          currentToken.familyId,
          now,
          'replay_detected',
        );
        await this.auditService.record({
          eventType: AuditEventTypes.OidcRefreshTokenReplayDetected,
          severity: AuditSeverity.CRITICAL,
          actorUserId: currentToken.userId,
          clientId: currentToken.clientId,
          providerSessionId: currentToken.providerSessionId,
          metadata: {
            tokenId: currentToken.id,
            familyId: currentToken.familyId,
          },
        });
        throw new ConflictException(
          'Refresh token replay detected. Token family revoked.',
        );
      }

      assertTokenIsUsable(currentToken, now);

      const client = await manager.getRepository(OidcClientEntity).findOne({
        where: {
          id: currentToken.clientId,
          clientId: input.clientIdentifier,
        },
      });

      if (
        !client ||
        client.status !== OidcClientStatus.ACTIVE ||
        !client.allowRefreshTokens ||
        !client.refreshTokenIdleTtlSeconds ||
        !client.refreshTokenAbsoluteTtlSeconds
      ) {
        throw new UnauthorizedException('Invalid refresh token client.');
      }

      assertClientSecret(client, input.clientSecret);

      const user = await manager.getRepository(UserEntity).findOne({
        where: {
          id: currentToken.userId,
        },
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Invalid refresh token user.');
      }

      const successorRawToken = generateOpaqueRefreshToken();
      const successorId = `rtk_${ulid().toLowerCase()}`;
      const successor = repository.create({
        id: successorId,
        tokenHash: hashRefreshToken(successorRawToken),
        upstreamRefreshTokenCiphertext:
          currentToken.upstreamRefreshTokenCiphertext,
        userId: currentToken.userId,
        clientId: currentToken.clientId,
        providerSessionId: currentToken.providerSessionId,
        parentTokenId: currentToken.id,
        rotatedToTokenId: null,
        familyId: currentToken.familyId,
        issuedAt: now,
        lastUsedAt: null,
        idleExpiresAt: addSeconds(now, client.refreshTokenIdleTtlSeconds),
        absoluteExpiresAt: addSeconds(
          currentToken.issuedAt,
          client.refreshTokenAbsoluteTtlSeconds,
        ),
        revokedAt: null,
        revocationReason: null,
      });

      currentToken.lastUsedAt = now;
      currentToken.rotatedToTokenId = successorId;
      currentToken.revokedAt = now;
      currentToken.revocationReason = 'rotated';

      await repository.save(successor);
      await repository.save(currentToken);
      await this.auditService.record({
        eventType: AuditEventTypes.OidcRefreshTokenRotated,
        severity: AuditSeverity.INFO,
        actorUserId: currentToken.userId,
        clientId: currentToken.clientId,
        providerSessionId: currentToken.providerSessionId,
        metadata: {
          tokenId: currentToken.id,
          successorTokenId: successorId,
          familyId: currentToken.familyId,
        },
      });

      return {
        refreshToken: successorRawToken,
        tokenId: successorId,
        familyId: currentToken.familyId,
        idleExpiresAt: successor.idleExpiresAt,
        absoluteExpiresAt: successor.absoluteExpiresAt,
        token: {
          id: successorId,
          familyId: currentToken.familyId,
          userId: currentToken.userId,
          clientId: currentToken.clientId,
          providerSessionId: currentToken.providerSessionId,
        },
        client: {
          id: client.id,
          clientId: client.clientId,
          accessTokenTtlSeconds: client.accessTokenTtlSeconds,
          idTokenTtlSeconds: client.idTokenTtlSeconds,
          allowedClaims: client.allowedClaims,
        },
      };
    });
  }

  async revokeTokenFamily(
    familyId: string,
    reason: string,
    now = new Date(),
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(OidcRefreshTokenEntity);
      const tokens = await this.revokeFamily(repository, familyId, now, reason);
      const sampleToken = tokens[0];

      if (!sampleToken) {
        return;
      }

      await this.auditService.record({
        eventType: AuditEventTypes.OidcRefreshTokenRevoked,
        severity: AuditSeverity.INFO,
        actorUserId: sampleToken.userId,
        clientId: sampleToken.clientId,
        providerSessionId: sampleToken.providerSessionId,
        metadata: {
          familyId,
          reason,
          revokedTokenCount: tokens.length,
        },
      });
    });
  }

  async revokePresentedToken(
    input: RevokePresentedRefreshTokenInput,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(OidcRefreshTokenEntity);
      const token = await repository.findOne({
        where: {
          tokenHash: hashRefreshToken(input.refreshToken),
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!token) {
        return;
      }

      const now = input.now ?? new Date();
      const tokens = await this.revokeFamily(
        repository,
        token.familyId,
        now,
        input.reason,
      );

      await this.auditService.record({
        eventType: AuditEventTypes.OidcRefreshTokenRevoked,
        severity: AuditSeverity.INFO,
        actorUserId: token.userId,
        clientId: token.clientId,
        providerSessionId: token.providerSessionId,
        metadata: {
          familyId: token.familyId,
          reason: input.reason,
          revokedTokenCount: tokens.length,
        },
      });
    });
  }

  private async revokeFamily(
    repository: Repository<OidcRefreshTokenEntity>,
    familyId: string,
    now: Date,
    reason: string,
  ): Promise<OidcRefreshTokenEntity[]> {
    const familyTokens = await repository.find({
      where: {
        familyId,
      },
    });

    if (familyTokens.length === 0) {
      return [];
    }

    for (const token of familyTokens) {
      if (!token.revokedAt) {
        token.revokedAt = now;
      }

      if (!token.revocationReason) {
        token.revocationReason = reason;
      }
    }

    await repository.save(familyTokens);
    return familyTokens;
  }

  private encryptUpstreamRefreshToken(refreshToken: string): string {
    const iv = randomBytes(12);
    const key = createHash('sha256')
      .update(this.configService.get('betterAuth.secret'))
      .digest();
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(refreshToken, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, ciphertext]
      .map((buffer) => buffer.toString('base64url'))
      .join('.');
  }

  private decryptUpstreamRefreshToken(ciphertext: string): string {
    const [ivPart, authTagPart, payloadPart] = ciphertext.split('.');

    if (!ivPart || !authTagPart || !payloadPart) {
      throw new InternalServerErrorException(
        'Refresh token mapping ciphertext is invalid.',
      );
    }

    const key = createHash('sha256')
      .update(this.configService.get('betterAuth.secret'))
      .digest();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payloadPart, 'base64url')),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }
}

function generateOpaqueRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}

function addSeconds(date: Date, ttlSeconds: number): Date {
  return new Date(date.getTime() + ttlSeconds * 1000);
}

function assertTokenIsUsable(token: OidcRefreshTokenEntity, now: Date): void {
  if (token.revokedAt) {
    throw new UnauthorizedException('Refresh token has been revoked.');
  }

  if (token.idleExpiresAt <= now || token.absoluteExpiresAt <= now) {
    throw new UnauthorizedException('Refresh token has expired.');
  }
}

function assertClientSecret(
  client: OidcClientEntity,
  clientSecret: string | null | undefined,
): void {
  if (client.type === OidcClientType.PUBLIC) {
    return;
  }

  if (!client.clientSecretHash || !clientSecret) {
    throw new UnauthorizedException('Client authentication required.');
  }

  if (hashRefreshToken(clientSecret) !== client.clientSecretHash) {
    throw new UnauthorizedException('Client authentication failed.');
  }
}
