import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { monotonicFactory } from 'ulid';
import { IsNull, Repository } from 'typeorm';
import {
  normalizeLimit,
  toCursorPage,
  type CursorPage,
} from './admin-pagination';
import { AuditService } from '../audit/audit.service';
import { AuditEventTypes, type AuditEventType } from '../audit/audit.types';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { OidcRefreshTokenEntity } from '../database/entities/oidc-refresh-token.entity';
import {
  UserEntity,
  UserProfileType,
  UserStatus,
} from '../database/entities/user.entity';
import type { AdminPrincipal } from './admin-access.service';

const nextUlid = monotonicFactory();

function prefixedUlid(prefix: string): string {
  return `${prefix}_${nextUlid().toLowerCase()}`;
}

export interface AdminCreateUserInput {
  email: string;
  displayName: string;
  givenName?: string | null;
  familyName?: string | null;
  username?: string | null;
  profileType?: UserProfileType;
}

export interface AdminUpdateUserInput {
  email?: string;
  displayName?: string;
  givenName?: string | null;
  familyName?: string | null;
  username?: string | null;
  profileType?: UserProfileType;
}

export interface AdminMutationContext {
  principal: AdminPrincipal;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface SetUserStatusResult {
  user: UserEntity;
  // Present only when deactivation revoked live security state.
  revokedProviderSessionCount?: number;
  revokedRefreshTokenCount?: number;
}

export interface AdminUserListParams {
  cursor?: string;
  limit?: number;
  status?: UserStatus;
  q?: string;
}

@Injectable()
export class AdminUserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(OidcProviderSessionEntity)
    private readonly providerSessionRepository: Repository<OidcProviderSessionEntity>,
    @InjectRepository(OidcRefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<OidcRefreshTokenEntity>,
    private readonly auditService: AuditService,
  ) {}

  async listUsers(
    params: AdminUserListParams,
  ): Promise<CursorPage<UserEntity>> {
    const limit = normalizeLimit(params.limit);
    const query = this.userRepository
      .createQueryBuilder('user')
      .orderBy('user.id', 'DESC')
      .take(limit + 1);

    if (params.status) {
      query.andWhere('user.status = :status', { status: params.status });
    }

    if (params.q) {
      const term = `%${params.q.trim().toLowerCase()}%`;
      query.andWhere(
        '(LOWER(user.email) LIKE :term OR LOWER(user.displayName) LIKE :term OR user.normalizedUsername LIKE :term)',
        { term },
      );
    }

    if (params.cursor) {
      query.andWhere('user.id < :cursor', { cursor: params.cursor });
    }

    return toCursorPage(await query.getMany(), limit);
  }

  async getUserById(userId: string): Promise<UserEntity> {
    return this.getExistingUser(userId);
  }

  async createUser(
    input: AdminCreateUserInput,
    context: AdminMutationContext,
  ): Promise<UserEntity> {
    const email = normalizeRequired(input.email, 'email');
    const normalizedEmail = normalizeEmail(email);
    const username = normalizeOptional(input.username);
    const normalizedUsername = username ? normalizeUsername(username) : null;

    await this.assertUniqueIdentity(normalizedEmail, normalizedUsername);

    const user = this.userRepository.create({
      id: prefixedUlid('usr'),
      email,
      normalizedEmail,
      emailVerifiedAt: null,
      username,
      normalizedUsername,
      displayName: normalizeRequired(input.displayName, 'displayName'),
      givenName: normalizeOptional(input.givenName),
      familyName: normalizeOptional(input.familyName),
      profileType: input.profileType ?? UserProfileType.EMPLOYEE,
      status: UserStatus.PENDING,
      deactivatedAt: null,
    });
    const savedUser = await this.userRepository.save(user);

    await this.auditAdminMutation(
      AuditEventTypes.AdminUserCreated,
      savedUser,
      context,
      {
        normalizedEmail,
        profileType: savedUser.profileType,
        status: savedUser.status,
      },
    );

    return savedUser;
  }

  async updateUser(
    userId: string,
    input: AdminUpdateUserInput,
    context: AdminMutationContext,
  ): Promise<UserEntity> {
    const user = await this.getExistingUser(userId);

    if (input.email !== undefined) {
      const email = normalizeRequired(input.email, 'email');
      const normalizedEmail = normalizeEmail(email);

      if (normalizedEmail !== user.normalizedEmail) {
        await this.assertEmailAvailable(normalizedEmail);
      }

      user.email = email;
      user.normalizedEmail = normalizedEmail;
    }

    if (input.displayName !== undefined) {
      user.displayName = normalizeRequired(input.displayName, 'displayName');
    }

    if (input.username !== undefined) {
      const username = normalizeOptional(input.username);
      const normalizedUsername = username ? normalizeUsername(username) : null;

      if (normalizedUsername !== user.normalizedUsername) {
        await this.assertUsernameAvailable(normalizedUsername);
      }

      user.username = username;
      user.normalizedUsername = normalizedUsername;
    }

    if (input.givenName !== undefined) {
      user.givenName = normalizeOptional(input.givenName);
    }

    if (input.familyName !== undefined) {
      user.familyName = normalizeOptional(input.familyName);
    }

    if (input.profileType !== undefined) {
      user.profileType = input.profileType;
    }

    const savedUser = await this.userRepository.save(user);

    await this.auditAdminMutation(
      AuditEventTypes.AdminUserUpdated,
      savedUser,
      context,
      {
        normalizedEmail: savedUser.normalizedEmail,
        normalizedUsername: savedUser.normalizedUsername,
        profileType: savedUser.profileType,
      },
    );

    return savedUser;
  }

  async setUserStatus(
    userId: string,
    status: UserStatus,
    context: AdminMutationContext,
  ): Promise<SetUserStatusResult> {
    const user = await this.getExistingUser(userId);

    user.status = status;
    const deactivatedAt = status === UserStatus.DEACTIVATED ? new Date() : null;
    user.deactivatedAt = deactivatedAt;

    const savedUser = await this.userRepository.save(user);
    const revocationMetadata =
      status === UserStatus.DEACTIVATED
        ? await this.revokeUserSecurityState(user.id, deactivatedAt)
        : {};

    await this.auditAdminMutation(
      AuditEventTypes.AdminUserStatusChanged,
      savedUser,
      context,
      {
        status,
        ...revocationMetadata,
      },
    );

    return {
      user: savedUser,
      ...revocationMetadata,
    };
  }

  private async getExistingUser(userId: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  private async assertUniqueIdentity(
    normalizedEmail: string,
    normalizedUsername: string | null,
  ): Promise<void> {
    await this.assertEmailAvailable(normalizedEmail);
    await this.assertUsernameAvailable(normalizedUsername);
  }

  private async assertEmailAvailable(normalizedEmail: string): Promise<void> {
    const existingUser = await this.userRepository.findOne({
      where: {
        normalizedEmail,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email is already in use.');
    }
  }

  private async assertUsernameAvailable(
    normalizedUsername: string | null,
  ): Promise<void> {
    if (!normalizedUsername) {
      return;
    }

    const existingUser = await this.userRepository.findOne({
      where: {
        normalizedUsername,
      },
    });

    if (existingUser) {
      throw new ConflictException('Username is already in use.');
    }
  }

  private auditAdminMutation(
    eventType: AuditEventType,
    targetUser: UserEntity,
    context: AdminMutationContext,
    metadata: Record<string, unknown>,
  ): Promise<string> {
    return this.auditService.record({
      eventType,
      severity: AuditSeverity.INFO,
      actorUserId: context.principal.user.id,
      targetUserId: targetUser.id,
      providerSessionId: context.principal.providerSession.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata,
    });
  }

  private async revokeUserSecurityState(
    userId: string,
    now: Date | null,
  ): Promise<Record<string, number>> {
    if (!now) {
      return {};
    }

    const [providerSessionResult, refreshTokenResult] = await Promise.all([
      this.providerSessionRepository.update(
        {
          userId,
          revokedAt: IsNull(),
        },
        {
          revokedAt: now,
          revocationReason: 'user_deactivated',
        },
      ),
      this.refreshTokenRepository.update(
        {
          userId,
          revokedAt: IsNull(),
        },
        {
          revokedAt: now,
          revocationReason: 'user_deactivated',
        },
      ),
    ]);

    return {
      revokedProviderSessionCount: providerSessionResult.affected ?? 0,
      revokedRefreshTokenCount: refreshTokenResult.affected ?? 0,
    };
  }
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new BadRequestException(`${fieldName} is required.`);
  }

  return normalizedValue;
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeEmail(email: string): string {
  return email.toLowerCase();
}

function normalizeUsername(username: string): string {
  return username.toLowerCase();
}
