import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { monotonicFactory } from 'ulid';
import { DataSource, IsNull, Repository } from 'typeorm';
import { upsertBetterAuthCredential } from '../better-auth/better-auth-credential';
import { AuditService } from '../audit/audit.service';
import { AuditEventTypes } from '../audit/audit.types';
import { AppConfigService } from '../config/app-config.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { OidcRefreshTokenEntity } from '../database/entities/oidc-refresh-token.entity';
import { PasswordResetEntity } from '../database/entities/password-reset.entity';
import { UserEntity, UserStatus } from '../database/entities/user.entity';
import { MailService } from '../mail/mail.service';

const MIN_PASSWORD_LENGTH = 8;
const GENERIC_RESET_ERROR = 'This reset link is invalid or has expired.';

export interface PasswordResetRequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface PasswordResetSummary {
  email: string;
}

const nextUlid = monotonicFactory();

function prefixedUlid(prefix: string): string {
  return `${prefix}_${nextUlid().toLowerCase()}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly resetTtlHours: number;
  private readonly appBaseUrl: string;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(PasswordResetEntity)
    private readonly resetRepository: Repository<PasswordResetEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(OidcProviderSessionEntity)
    private readonly providerSessionRepository: Repository<OidcProviderSessionEntity>,
    @InjectRepository(OidcRefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<OidcRefreshTokenEntity>,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
    configService: AppConfigService,
  ) {
    this.resetTtlHours = configService.get('mail.passwordResetTtlHours');
    this.appBaseUrl = configService.get('app.baseUrl');
  }

  async requestReset(
    email: string,
    context: PasswordResetRequestContext,
  ): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { normalizedEmail },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return;
    }

    const rawToken = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.resetTtlHours * 60 * 60 * 1000,
    );

    try {
      await this.mailService.sendPasswordResetEmail({
        to: user.email,
        displayName: user.displayName,
        resetUrl: `${this.appBaseUrl}/admin/reset-password/${rawToken}`,
        expiresAt,
      });
    } catch (error) {
      this.logger.error(
        `Could not send password reset email to ${user.email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    await this.resetRepository.update(
      {
        userId: user.id,
        consumedAt: IsNull(),
        revokedAt: IsNull(),
      },
      {
        revokedAt: now,
      },
    );

    const reset = this.resetRepository.create({
      id: prefixedUlid('pwr'),
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
      consumedAt: null,
      revokedAt: null,
    });
    await this.resetRepository.save(reset);

    await this.auditService.record({
      eventType: AuditEventTypes.UserPasswordResetRequested,
      severity: AuditSeverity.INFO,
      actorUserId: user.id,
      targetUserId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        expiresAt: expiresAt.toISOString(),
      },
    });
  }

  async getReset(token: string): Promise<PasswordResetSummary> {
    const reset = await this.resolveValidReset(token);

    return { email: reset.user.email };
  }

  async resetPassword(
    token: string,
    password: string,
    context: PasswordResetRequestContext,
  ): Promise<void> {
    const reset = await this.resolveValidReset(token);

    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }

    await upsertBetterAuthCredential(this.dataSource, {
      userId: reset.user.id,
      email: reset.user.email,
      displayName: reset.user.displayName,
      password,
    });

    const now = new Date();
    reset.consumedAt = now;
    await this.resetRepository.save(reset);

    await Promise.all([
      this.providerSessionRepository.update(
        { userId: reset.user.id, revokedAt: IsNull() },
        { revokedAt: now, revocationReason: 'password_reset' },
      ),
      this.refreshTokenRepository.update(
        { userId: reset.user.id, revokedAt: IsNull() },
        { revokedAt: now, revocationReason: 'password_reset' },
      ),
    ]);

    await this.auditService.record({
      eventType: AuditEventTypes.UserPasswordResetCompleted,
      severity: AuditSeverity.INFO,
      actorUserId: reset.user.id,
      targetUserId: reset.user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {},
    });
  }

  private async resolveValidReset(
    token: string,
  ): Promise<PasswordResetEntity & { user: UserEntity }> {
    const reset = token
      ? await this.resetRepository.findOne({
          where: { tokenHash: hashToken(token) },
          relations: ['user'],
        })
      : null;
    const now = new Date();

    if (
      !reset ||
      reset.revokedAt ||
      reset.consumedAt ||
      reset.expiresAt <= now ||
      reset.user.status !== UserStatus.ACTIVE
    ) {
      throw new NotFoundException(GENERIC_RESET_ERROR);
    }

    return reset;
  }
}
