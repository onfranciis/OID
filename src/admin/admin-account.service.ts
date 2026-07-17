import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuditEventTypes } from '../audit/audit.types';
import { BetterAuthService } from '../better-auth/better-auth.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
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

    await this.auditService.record({
      eventType: AuditEventTypes.AdminAccountPasswordChanged,
      severity: AuditSeverity.INFO,
      actorUserId: context.principal.user.id,
      targetUserId: context.principal.user.id,
      providerSessionId: context.principal.providerSession.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
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
