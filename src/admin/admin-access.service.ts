import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { GroupEntity } from '../database/entities/group.entity';
import { GroupMembershipEntity } from '../database/entities/group-membership.entity';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { UserEntity, UserStatus } from '../database/entities/user.entity';

export interface AdminAccessContext {
  providerSessionToken: string | null;
  now?: Date;
}

export interface AdminPrincipal {
  user: UserEntity;
  providerSession: OidcProviderSessionEntity;
}

@Injectable()
export class AdminAccessService {
  private readonly adminGroupSlug: string;

  constructor(
    configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(GroupMembershipEntity)
    private readonly membershipRepository: Repository<GroupMembershipEntity>,
    @InjectRepository(OidcProviderSessionEntity)
    private readonly providerSessionRepository: Repository<OidcProviderSessionEntity>,
  ) {
    this.adminGroupSlug = configService.getOrThrow<string>(
      'bootstrap.adminGroupSlug',
    );
  }

  async requireAdminAccess(
    context: AdminAccessContext,
  ): Promise<AdminPrincipal> {
    const now = context.now ?? new Date();

    if (!context.providerSessionToken) {
      throw new UnauthorizedException('Admin authentication required.');
    }

    const providerSession = await this.providerSessionRepository.findOne({
      where: {
        sessionHash: hashToken(context.providerSessionToken),
      },
    });

    if (!providerSession || providerSession.revokedAt) {
      throw new UnauthorizedException('Admin authentication required.');
    }

    if (
      providerSession.idleExpiresAt <= now ||
      providerSession.absoluteExpiresAt <= now
    ) {
      throw new UnauthorizedException('Admin session expired.');
    }

    const user = await this.userRepository.findOne({
      where: {
        id: providerSession.userId,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Admin access denied.');
    }

    const adminGroup = await this.groupRepository.findOne({
      where: {
        slug: this.adminGroupSlug,
      },
    });

    if (!adminGroup) {
      throw new ForbiddenException('Admin access denied.');
    }

    const membership = await this.membershipRepository.findOne({
      where: {
        userId: user.id,
        groupId: adminGroup.id,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Admin access denied.');
    }

    return {
      user,
      providerSession,
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
