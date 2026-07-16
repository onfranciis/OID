import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { monotonicFactory } from 'ulid';
import { Repository } from 'typeorm';
import {
  normalizeLimit,
  toCursorPage,
  type CursorPage,
} from './admin-pagination';
import { AuditService } from '../audit/audit.service';
import { AuditEventTypes, type AuditEventType } from '../audit/audit.types';
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

export interface AdminGroupListParams {
  cursor?: string;
  limit?: number;
  q?: string;
}

export interface AdminGroupWithCount {
  group: GroupEntity;
  memberCount: number;
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

  async listGroups(
    params: AdminGroupListParams,
  ): Promise<CursorPage<AdminGroupWithCount>> {
    const limit = normalizeLimit(params.limit);
    const query = this.groupRepository
      .createQueryBuilder('group')
      .orderBy('group.id', 'DESC')
      .take(limit + 1);

    if (params.q) {
      const term = `%${params.q.trim().toLowerCase()}%`;
      query.andWhere(
        '(LOWER(group.slug) LIKE :term OR LOWER(group.displayName) LIKE :term)',
        { term },
      );
    }

    if (params.cursor) {
      query.andWhere('group.id < :cursor', { cursor: params.cursor });
    }

    const page = toCursorPage(await query.getMany(), limit);
    const counts = await this.countMembers(page.items.map((group) => group.id));

    return {
      items: page.items.map((group) => ({
        group,
        memberCount: counts.get(group.id) ?? 0,
      })),
      nextCursor: page.nextCursor,
    };
  }

  async getGroupById(groupId: string): Promise<GroupEntity> {
    return this.getExistingGroup(groupId);
  }

  async getGroupsForUser(userId: string): Promise<GroupEntity[]> {
    const memberships = await this.membershipRepository.find({
      where: { userId },
      relations: { group: true },
    });

    return memberships
      .map((membership) => membership.group)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async getGroupMembers(groupId: string): Promise<UserEntity[]> {
    const memberships = await this.membershipRepository.find({
      where: { groupId },
      relations: { user: true },
    });

    return memberships
      .map((membership) => membership.user)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  private async countMembers(groupIds: string[]): Promise<Map<string, number>> {
    if (groupIds.length === 0) {
      return new Map();
    }

    const rows = await this.membershipRepository
      .createQueryBuilder('membership')
      .select('membership.groupId', 'groupId')
      .addSelect('COUNT(*)', 'count')
      .where('membership.groupId IN (:...groupIds)', { groupIds })
      .groupBy('membership.groupId')
      .getRawMany<{ groupId: string; count: string }>();

    return new Map(rows.map((row) => [row.groupId, Number(row.count)]));
  }

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

    await this.auditGroupMutation(
      AuditEventTypes.AdminGroupCreated,
      savedGroup,
      context,
      {
        slug: savedGroup.slug,
      },
    );

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

    await this.auditGroupMutation(
      AuditEventTypes.AdminGroupUpdated,
      savedGroup,
      context,
      {
        slug: savedGroup.slug,
      },
    );

    return savedGroup;
  }

  async deleteGroup(
    groupId: string,
    context: AdminMutationContext,
  ): Promise<void> {
    const group = await this.getExistingGroup(groupId);
    const memberCount = await this.membershipRepository.count({
      where: { groupId },
    });

    if (memberCount > 0) {
      throw new ConflictException(
        'Remove all members before deleting the group.',
      );
    }

    await this.groupRepository.remove(group);
    await this.auditGroupMutation(
      AuditEventTypes.AdminGroupDeleted,
      group,
      context,
      {
        slug: group.slug,
      },
    );
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
      AuditEventTypes.AdminGroupMembershipAdded,
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
      AuditEventTypes.AdminGroupMembershipRemoved,
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
    eventType: AuditEventType,
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
