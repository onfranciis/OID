import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { monotonicFactory } from 'ulid';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
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

@Injectable()
export class AdminUserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly auditService: AuditService,
  ) {}

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

    await this.auditAdminMutation('admin.user.created', savedUser, context, {
      normalizedEmail,
      profileType: savedUser.profileType,
      status: savedUser.status,
    });

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

    await this.auditAdminMutation('admin.user.updated', savedUser, context, {
      normalizedEmail: savedUser.normalizedEmail,
      normalizedUsername: savedUser.normalizedUsername,
      profileType: savedUser.profileType,
    });

    return savedUser;
  }

  async setUserStatus(
    userId: string,
    status: UserStatus,
    context: AdminMutationContext,
  ): Promise<UserEntity> {
    const user = await this.getExistingUser(userId);

    user.status = status;
    user.deactivatedAt = status === UserStatus.DEACTIVATED ? new Date() : null;

    const savedUser = await this.userRepository.save(user);

    await this.auditAdminMutation(
      'admin.user.status_changed',
      savedUser,
      context,
      {
        status,
      },
    );

    return savedUser;
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
    eventType: string,
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
