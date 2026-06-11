import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { ulid } from 'ulid';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { OidcRefreshTokenEntity } from '../database/entities/oidc-refresh-token.entity';
import type {
  IssueRefreshTokenInput,
  IssueRefreshTokenResult,
  RotateRefreshTokenInput,
} from './refresh-token.types';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(OidcRefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<OidcRefreshTokenEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

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
        eventType: 'oidc.refresh_token.rotated',
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
          eventType: 'oidc.refresh_token.replay_detected',
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
        eventType: 'oidc.refresh_token.rotated',
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
        eventType: 'oidc.refresh_token.revoked',
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
