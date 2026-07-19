import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { upsertBetterAuthCredential } from '../better-auth/better-auth-credential';
import { AuditService } from '../audit/audit.service';
import { AuditEventTypes } from '../audit/audit.types';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { UserInviteEntity } from '../database/entities/user-invite.entity';
import { UserEntity, UserStatus } from '../database/entities/user.entity';

const MIN_PASSWORD_LENGTH = 8;

export interface InviteSummary {
  email: string;
  displayName: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Public (unauthenticated) counterpart to AdminInviteService: resolves the
// emailed token and, on accept, gives the invited user a real Better Auth
// credential and activates their account — the step that was previously
// missing entirely from admin-created users.
@Injectable()
export class InviteAcceptService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(UserInviteEntity)
    private readonly inviteRepository: Repository<UserInviteEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly auditService: AuditService,
  ) {}

  async getInvite(token: string): Promise<InviteSummary> {
    const invite = await this.resolveValidInvite(token);

    return {
      email: invite.user.email,
      displayName: invite.user.displayName,
    };
  }

  async accept(
    token: string,
    password: string,
    context: { ipAddress: string | null; userAgent: string | null },
  ): Promise<void> {
    const invite = await this.resolveValidInvite(token);

    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }

    await upsertBetterAuthCredential(this.dataSource, {
      userId: invite.user.id,
      email: invite.user.email,
      displayName: invite.user.displayName,
      password,
    });

    invite.consumedAt = new Date();
    await this.inviteRepository.save(invite);

    // Successfully accepting an emailed, single-use link is proof of control
    // over that inbox — the standard basis for email verification — in
    // addition to the more obvious "user is now usable" activation.
    let userChanged = false;

    if (invite.user.status === UserStatus.PENDING) {
      invite.user.status = UserStatus.ACTIVE;
      userChanged = true;
    }

    if (!invite.user.emailVerifiedAt) {
      invite.user.emailVerifiedAt = new Date();
      userChanged = true;
    }

    if (userChanged) {
      await this.userRepository.save(invite.user);
    }

    await this.auditService.record({
      eventType: AuditEventTypes.UserInviteAccepted,
      severity: AuditSeverity.INFO,
      actorUserId: invite.user.id,
      targetUserId: invite.user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {},
    });
  }

  private async resolveValidInvite(
    token: string,
  ): Promise<UserInviteEntity & { user: UserEntity }> {
    const invite = token
      ? await this.inviteRepository.findOne({
          where: { tokenHash: hashToken(token) },
          relations: ['user'],
        })
      : null;
    const now = new Date();

    if (
      !invite ||
      invite.revokedAt ||
      invite.consumedAt ||
      invite.expiresAt <= now
    ) {
      throw new NotFoundException(
        'This invite link is invalid or has expired.',
      );
    }

    return invite;
  }
}
