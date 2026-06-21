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
import { GroupMembershipEntity } from '../database/entities/group-membership.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserEntity } from '../database/entities/user.entity';
import type { AdminMutationContext } from './admin-user.service';

const nextUlid = monotonicFactory();

function prefixedUlid(prefix: string): string {
  return `${prefix}_${nextUlid().toLowerCase()}`;
}

export interface AdminCreateGroupInput {
  slug: string;
  displayName: string;
  description?: string | null;
}

export interface AdminUpdateGroupInput {
  slug?: string;
  displayName?: string;
  description?: string | null;
}

@Injectable()
export class AdminGroupService {
  constructor(
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(GroupMembershipEntity)
    private readonly membershipRepository: Repository<GroupMembershipEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createGroup(
    input: AdminCreateGroupInput,
    context: AdminMutationContext,
  ): Promise<GroupEntity> {
    const slug = normalizeSlug(input.slug);
    await this.assertSlugAvailable(slug);

    const group = this.groupRepository.create({
      id: prefixedUlid('grp'),
      slug,
      displayName: normalizeRequired(input.displayName, 'displayName'),
      description: normalizeOptional(input.description),
    });
    const savedGroup = await this.groupRepository.save(group);

    await this.auditGroupMutation('admin.group.created', savedGroup, context, {
      slug: savedGroup.slug,
    });

    return savedGroup;
  }

  async updateGroup(
    groupId: string,
    input: AdminUpdateGroupInput,
    context: AdminMutationContext,
  ): Promise<GroupEntity> {
    const group = await this.getExistingGroup(groupId);

    if (input.slug !== undefined) {
      const slug = normalizeSlug(input.slug);

      if (slug !== group.slug) {
        await this.assertSlugAvailable(slug);
      }

      group.slug = slug;
    }

    if (input.displayName !== undefined) {
      group.displayName = normalizeRequired(input.displayName, 'displayName');
    }

    if (input.description !== undefined) {
      group.description = normalizeOptional(input.description);
    }

    const savedGroup = await this.groupRepository.save(group);

    await this.auditGroupMutation('admin.group.updated', savedGroup, context, {
      slug: savedGroup.slug,
    });

    return savedGroup;
  }

  async addMembership(
    groupId: string,
    userId: string,
    context: AdminMutationContext,
  ): Promise<GroupMembershipEntity> {
    const group = await this.getExistingGroup(groupId);
    await this.assertUserExists(userId);

    const existingMembership = await this.membershipRepository.findOne({
      where: {
        userId,
        groupId,
      },
    });

    if (existingMembership) {
      return existingMembership;
    }

    const membership = this.membershipRepository.create({
      userId,
      groupId,
      createdById: context.principal.user.id,
    });
    const savedMembership = await this.membershipRepository.save(membership);

    await this.auditGroupMutation(
      'admin.group.membership_added',
      group,
      context,
      {
        userId,
        groupId,
      },
    );

    return savedMembership;
  }

  async removeMembership(
    groupId: string,
    userId: string,
    context: AdminMutationContext,
  ): Promise<void> {
    const group = await this.getExistingGroup(groupId);
    const membership = await this.membershipRepository.findOne({
      where: {
        userId,
        groupId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Group membership not found.');
    }

    await this.membershipRepository.remove(membership);
    await this.auditGroupMutation(
      'admin.group.membership_removed',
      group,
      context,
      {
        userId,
        groupId,
      },
    );
  }

  private async getExistingGroup(groupId: string): Promise<GroupEntity> {
    const group = await this.groupRepository.findOne({
      where: {
        id: groupId,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    return group;
  }

  private async assertUserExists(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }
  }

  private async assertSlugAvailable(slug: string): Promise<void> {
    const existingGroup = await this.groupRepository.findOne({
      where: {
        slug,
      },
    });

    if (existingGroup) {
      throw new ConflictException('Group slug is already in use.');
    }
  }

  private auditGroupMutation(
    eventType: string,
    group: GroupEntity,
    context: AdminMutationContext,
    metadata: Record<string, unknown>,
  ): Promise<string> {
    return this.auditService.record({
      eventType,
      severity: AuditSeverity.INFO,
      actorUserId: context.principal.user.id,
      providerSessionId: context.principal.providerSession.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        groupId: group.id,
        ...metadata,
      },
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

function normalizeSlug(slug: string): string {
  return normalizeRequired(slug, 'slug').toLowerCase();
}
