import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminUserService } from './admin-user.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import {
  UserEntity,
  UserProfileType,
  UserStatus,
} from '../database/entities/user.entity';

describe('AdminUserService', () => {
  const findOne = vi.fn();
  const create = vi.fn((input: Partial<UserEntity>) => input as UserEntity);
  const save = vi.fn((input: UserEntity) =>
    Promise.resolve({
      ...input,
      id: input.id ?? 'usr_created',
    }),
  );
  const record = vi.fn<(input: unknown) => Promise<string>>(() =>
    Promise.resolve('evt_123'),
  );
  const service = new AdminUserService(
    {
      findOne,
      create,
      save,
    } as never,
    {
      record,
    } as never,
  );
  const principal = {
    user: {
      id: 'usr_admin',
    },
    providerSession: {
      id: 'psn_admin',
    },
  } as never;
  const context = {
    principal,
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
  };

  beforeEach(() => {
    findOne.mockReset();
    create.mockClear();
    save.mockClear();
    record.mockClear();
  });

  it('creates pending users with normalized identity fields and audit', async () => {
    findOne.mockResolvedValue(null);

    const user = await service.createUser(
      {
        email: ' New.User@Company.com ',
        displayName: ' New User ',
        givenName: ' New ',
        familyName: ' User ',
        username: ' New.User ',
        profileType: UserProfileType.CONTRACTOR,
      },
      context,
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'New.User@Company.com',
        normalizedEmail: 'new.user@company.com',
        username: 'New.User',
        normalizedUsername: 'new.user',
        displayName: 'New User',
        givenName: 'New',
        familyName: 'User',
        profileType: UserProfileType.CONTRACTOR,
        status: UserStatus.PENDING,
      }),
    );
    expect(user.id).toMatch(/^usr_/);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.user.created',
        severity: AuditSeverity.INFO,
        actorUserId: 'usr_admin',
        targetUserId: user.id,
        providerSessionId: 'psn_admin',
      }),
    );
  });

  it('rejects duplicate emails', async () => {
    findOne.mockResolvedValueOnce({
      id: 'usr_existing',
    });

    await expect(
      service.createUser(
        {
          email: 'existing@company.com',
          displayName: 'Existing User',
        },
        context,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(save).not.toHaveBeenCalled();
  });

  it('updates editable profile fields and audits the change', async () => {
    findOne
      .mockResolvedValueOnce({
        id: 'usr_target',
        email: 'old@company.com',
        normalizedEmail: 'old@company.com',
        username: null,
        normalizedUsername: null,
        displayName: 'Old User',
        givenName: null,
        familyName: null,
        profileType: UserProfileType.EMPLOYEE,
        status: UserStatus.PENDING,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const user = await service.updateUser(
      'usr_target',
      {
        email: 'new@company.com',
        displayName: 'New User',
        username: 'new.user',
        profileType: UserProfileType.SERVICE,
      },
      context,
    );

    expect(user).toMatchObject({
      id: 'usr_target',
      normalizedEmail: 'new@company.com',
      normalizedUsername: 'new.user',
      profileType: UserProfileType.SERVICE,
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.user.updated',
        targetUserId: 'usr_target',
      }),
    );
  });

  it('throws not found when updating missing users', async () => {
    findOne.mockResolvedValueOnce(null);

    await expect(
      service.updateUser(
        'usr_missing',
        {
          displayName: 'Missing User',
        },
        context,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sets deactivated timestamps on deactivation and audits status changes', async () => {
    findOne.mockResolvedValueOnce({
      id: 'usr_target',
      status: UserStatus.ACTIVE,
      deactivatedAt: null,
    });

    const user = await service.setUserStatus(
      'usr_target',
      UserStatus.DEACTIVATED,
      context,
    );

    expect(user.status).toBe(UserStatus.DEACTIVATED);
    expect(user.deactivatedAt).toBeInstanceOf(Date);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.user.status_changed',
        targetUserId: 'usr_target',
        metadata: {
          status: UserStatus.DEACTIVATED,
        },
      }),
    );
  });
});
