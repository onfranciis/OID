import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditEventTypes } from '../audit/audit.types';
import { BetterAuthService } from '../better-auth/better-auth.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { OidcRefreshTokenEntity } from '../database/entities/oidc-refresh-token.entity';
import type { AdminMutationContext } from './admin-user.service';

const GENERIC_CHANGE_PASSWORD_ERROR =
  'Could not change your password. Check your current password and try again.';

export interface AdminChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  cookieHeader?: string;
}

@Injectable()
export class AdminAccountService {
  constructor(
    private readonly betterAuthService: BetterAuthService,
    private readonly auditService: AuditService,
    @InjectRepository(OidcProviderSessionEntity)
    private readonly providerSessionRepository: Repository<OidcProviderSessionEntity>,
    @InjectRepository(OidcRefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<OidcRefreshTokenEntity>,
  ) {}

  async changePassword(
    input: AdminChangePasswordInput,
    context: AdminMutationContext,
  ): Promise<void> {
    const currentPassword = requireNonEmpty(
      input.currentPassword,
      'currentPassword',
    );
    const newPassword = requireNonEmpty(input.newPassword, 'newPassword');

    const response = await this.betterAuthService.changePassword({
      currentPassword,
      newPassword,
      cookieHeader: input.cookieHeader,
    });

    if (!response.ok) {
      throw new BadRequestException(
        (await extractErrorMessage(response)) ?? GENERIC_CHANGE_PASSWORD_ERROR,
      );
    }

    const userId = context.principal.user.id;
    const currentSessionId = context.principal.providerSession.id;
    const now = new Date();
    const [providerSessionResult, refreshTokenResult] = await Promise.all([
      this.providerSessionRepository.update(
        { userId, revokedAt: IsNull(), id: Not(currentSessionId) },
        { revokedAt: now, revocationReason: 'password_changed' },
      ),
      this.refreshTokenRepository.update(
        { userId, revokedAt: IsNull() },
        { revokedAt: now, revocationReason: 'password_changed' },
      ),
    ]);

    await this.auditService.record({
      eventType: AuditEventTypes.AdminAccountPasswordChanged,
      severity: AuditSeverity.INFO,
      actorUserId: userId,
      targetUserId: userId,
      providerSessionId: currentSessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        revokedProviderSessionCount: providerSessionResult.affected ?? 0,
        revokedRefreshTokenCount: refreshTokenResult.affected ?? 0,
      },
    });
  }
}

function requireNonEmpty(value: string, fieldName: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BadRequestException(`${fieldName} is required.`);
  }

  return value;
}

async function extractErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: unknown };

    return typeof body.message === 'string' ? body.message : null;
  } catch {
    return null;
  }
}
