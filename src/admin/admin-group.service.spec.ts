import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminGroupService } from './admin-group.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';

describe('AdminGroupService', () => {
  const findGroup = vi.fn();
  const createGroup = vi.fn((input: unknown) => input);
  const saveGroup = vi.fn((input: { id?: string }) =>
    Promise.resolve({
      ...input,
      id: input.id ?? 'grp_created',
    }),
  );
  const findMembership = vi.fn();
  const createMembership = vi.fn((input: unknown) => input);
  const saveMembership = vi.fn((input: unknown) => Promise.resolve(input));
  const removeMembership = vi.fn(() => Promise.resolve());
  const countMembership = vi.fn<() => Promise<number>>(() =>
    Promise.resolve(0),
  );
  const removeGroup = vi.fn(() => Promise.resolve());
  const findUser = vi.fn();
  const record = vi.fn<(input: unknown) => Promise<string>>(() =>
    Promise.resolve('evt_123'),
  );
  const service = new AdminGroupService(
    {
      findOne: findGroup,
      create: createGroup,
      save: saveGroup,
      remove: removeGroup,
    } as never,
    {
      findOne: findMembership,
      create: createMembership,
      save: saveMembership,
      remove: removeMembership,
      count: countMembership,
    } as never,
    {
      findOne: findUser,
    } as never,
    {
      record,
    } as never,
  );
  const context = {
    principal: {
      user: {
        id: 'usr_admin',
      },
      providerSession: {
        id: 'psn_admin',
      },
    } as never,
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
  };

  beforeEach(() => {
    findGroup.mockReset();
    createGroup.mockClear();
    saveGroup.mockClear();
    findMembership.mockReset();
    createMembership.mockClear();
    saveMembership.mockClear();
    removeMembership.mockClear();
    countMembership.mockReset();
    countMembership.mockResolvedValue(0);
    removeGroup.mockClear();
    findUser.mockReset();
    record.mockClear();
  });

  it('creates groups with normalized slugs and audit events', async () => {
    findGroup.mockResolvedValue(null);

    const group = await service.createGroup(
      {
        slug: ' Engineering ',
        displayName: ' Engineering ',
        description: ' Product engineering ',
      },
      context,
    );

    expect(createGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'engineering',
        displayName: 'Engineering',
        description: 'Product engineering',
      }),
    );
    expect(group.id).toMatch(/^grp_/);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.group.created',
        severity: AuditSeverity.INFO,
        actorUserId: 'usr_admin',
        providerSessionId: 'psn_admin',
      }),
    );
  });

  it('rejects duplicate group slugs', async () => {
    findGroup.mockResolvedValueOnce({
      id: 'grp_existing',
    });

    await expect(
      service.createGroup(
        {
          slug: 'engineering',
          displayName: 'Engineering',
        },
        context,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(saveGroup).not.toHaveBeenCalled();
  });

  it('updates groups and audits the change', async () => {
    findGroup.mockResolvedValueOnce({
      id: 'grp_target',
      slug: 'old',
      displayName: 'Old',
      description: null,
    });
    findGroup.mockResolvedValueOnce(null);

    const group = await service.updateGroup(
      'grp_target',
      {
        slug: 'new',
        displayName: 'New Group',
        description: null,
      },
      context,
    );

    expect(group).toMatchObject({
      id: 'grp_target',
      slug: 'new',
      displayName: 'New Group',
      description: null,
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.group.updated',
      }),
    );
  });

  it('adds memberships when the group and user exist', async () => {
    findGroup.mockResolvedValueOnce({
      id: 'grp_target',
      slug: 'engineering',
    });
    findUser.mockResolvedValueOnce({
      id: 'usr_target',
    });
    findMembership.mockResolvedValueOnce(null);

    await expect(
      service.addMembership('grp_target', 'usr_target', context),
    ).resolves.toMatchObject({
      userId: 'usr_target',
      groupId: 'grp_target',
      createdById: 'usr_admin',
    });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.group.membership_added',
      }),
    );
    expect(record.mock.calls[0]?.[0]).toMatchObject({
      metadata: {
        userId: 'usr_target',
        groupId: 'grp_target',
      },
    });
  });

  it('removes memberships and audits the removal', async () => {
    const membership = {
      userId: 'usr_target',
      groupId: 'grp_target',
    };
    findGroup.mockResolvedValueOnce({
      id: 'grp_target',
      slug: 'engineering',
    });
    findMembership.mockResolvedValueOnce(membership);

    await expect(
      service.removeMembership('grp_target', 'usr_target', context),
    ).resolves.toBeUndefined();

    expect(removeMembership).toHaveBeenCalledWith(membership);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.group.membership_removed',
      }),
    );
  });

  it('rejects missing memberships on removal', async () => {
    findGroup.mockResolvedValueOnce({
      id: 'grp_target',
      slug: 'engineering',
    });
    findMembership.mockResolvedValueOnce(null);

    await expect(
      service.removeMembership('grp_target', 'usr_target', context),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes an empty group and audits it', async () => {
    const group = { id: 'grp_target', slug: 'people-ops' };
    findGroup.mockResolvedValueOnce(group);
    countMembership.mockResolvedValueOnce(0);

    await service.deleteGroup('grp_target', context);

    expect(removeGroup).toHaveBeenCalledWith(group);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.group.deleted',
        severity: AuditSeverity.INFO,
      }),
    );
  });

  it('refuses to delete a group that still has members', async () => {
    findGroup.mockResolvedValueOnce({ id: 'grp_target', slug: 'engineering' });
    countMembership.mockResolvedValueOnce(3);

    await expect(
      service.deleteGroup('grp_target', context),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(removeGroup).not.toHaveBeenCalled();
  });
});
