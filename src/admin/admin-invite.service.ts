import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { monotonicFactory } from 'ulid';
import { IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditEventTypes } from '../audit/audit.types';
import { AppConfigService } from '../config/app-config.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { UserInviteEntity } from '../database/entities/user-invite.entity';
import { UserEntity, UserStatus } from '../database/entities/user.entity';
import { MailService } from '../mail/mail.service';
import type { AdminMutationContext } from './admin-user.service';

const nextUlid = monotonicFactory();

function prefixedUlid(prefix: string): string {
  return `${prefix}_${nextUlid().toLowerCase()}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AdminInviteService {
  private readonly inviteTtlHours: number;
  private readonly appBaseUrl: string;

  constructor(
    configService: AppConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserInviteEntity)
    private readonly inviteRepository: Repository<UserInviteEntity>,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {
    this.inviteTtlHours = configService.get('mail.inviteTtlHours');
    this.appBaseUrl = configService.get('app.baseUrl');
  }

  async createInvite(
    userId: string,
    context: AdminMutationContext,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.id === context.principal.user.id) {
      throw new BadRequestException('You cannot send yourself an invite.');
    }

    if (user.status === UserStatus.DEACTIVATED) {
      throw new BadRequestException('Cannot invite a deactivated user.');
    }

    const rawToken = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.inviteTtlHours * 60 * 60 * 1000,
    );

    // Send first: a failed send must not leave an orphaned invite behind.
    try {
      await this.mailService.sendInviteEmail({
        to: user.email,
        displayName: user.displayName,
        invitedByDisplayName: context.principal.user.displayName,
        inviteUrl: `${this.appBaseUrl}/admin/invite/${rawToken}`,
        expiresAt,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? `Could not send the invite email: ${error.message}`
          : 'Could not send the invite email.',
      );
    }

    // Resending supersedes any prior unconsumed invite.
    await this.inviteRepository.update(
      {
        userId: user.id,
        consumedAt: IsNull(),
        revokedAt: IsNull(),
      },
      {
        revokedAt: now,
      },
    );

    const invite = this.inviteRepository.create({
      id: prefixedUlid('inv'),
      userId: user.id,
      tokenHash: hashToken(rawToken),
      invitedByUserId: context.principal.user.id,
      expiresAt,
      consumedAt: null,
      revokedAt: null,
    });
    await this.inviteRepository.save(invite);

    await this.auditService.record({
      eventType: AuditEventTypes.AdminUserInvited,
      severity: AuditSeverity.INFO,
      actorUserId: context.principal.user.id,
      targetUserId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        expiresAt: expiresAt.toISOString(),
      },
    });
  }
}
