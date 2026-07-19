import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../config/app-config.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { UserStatus } from '../database/entities/user.entity';
import { AdminInviteService } from './admin-invite.service';

describe('AdminInviteService', () => {
  const findUser = vi.fn();
  const updateInvites = vi.fn<
    (criteria: unknown, partial: unknown) => Promise<{ affected: number }>
  >(() => Promise.resolve({ affected: 0 }));
  const createInvite = vi.fn((input: unknown) => input);
  const saveInvite = vi.fn((input: { id?: string }) =>
    Promise.resolve({ ...input, id: input.id ?? 'inv_created' }),
  );
  const sendInviteEmail = vi.fn<(input: unknown) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const record = vi.fn<(input: unknown) => Promise<string>>(() =>
    Promise.resolve('evt_123'),
  );
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'mail.inviteTtlHours') return 72;
      if (key === 'app.baseUrl') return 'https://auth.company.com';
      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as unknown as AppConfigService;
  const service = new AdminInviteService(
    configService,
    { findOne: findUser } as never,
    {
      update: updateInvites,
      create: createInvite,
      save: saveInvite,
    } as never,
    { sendInviteEmail } as never,
    { record } as never,
  );
  const context = {
    principal: {
      user: {
        id: 'usr_admin',
        displayName: 'Admin',
        email: 'admin@company.com',
      },
      providerSession: { id: 'psn_admin' },
    } as never,
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
  };

  beforeEach(() => {
    findUser.mockReset();
    updateInvites.mockClear();
    createInvite.mockClear();
    saveInvite.mockClear();
    sendInviteEmail.mockClear();
    record.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('throws not found for a missing user', async () => {
    findUser.mockResolvedValue(null);

    await expect(
      service.createInvite('usr_missing', context),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to invite a deactivated user', async () => {
    findUser.mockResolvedValue({
      id: 'usr_1',
      status: UserStatus.DEACTIVATED,
    });

    await expect(service.createInvite('usr_1', context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses to let an admin invite themselves', async () => {
    findUser.mockResolvedValue({
      id: 'usr_admin',
      email: 'admin@company.com',
      displayName: 'Admin',
      status: UserStatus.ACTIVE,
    });

    await expect(
      service.createInvite('usr_admin', context),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sendInviteEmail).not.toHaveBeenCalled();
  });

  it('supersedes outstanding invites, emails the link, and audits the send', async () => {
    findUser.mockResolvedValue({
      id: 'usr_1',
      email: 'new.user@company.com',
      displayName: 'New User',
      status: UserStatus.PENDING,
    });

    await service.createInvite('usr_1', context);

    expect(updateInvites).toHaveBeenCalledTimes(1);
    const [criteria, patch] = updateInvites.mock.calls[0] ?? [];
    expect(criteria).toMatchObject({ userId: 'usr_1' });
    expect((patch as { revokedAt: Date }).revokedAt).toBeInstanceOf(Date);
    expect(saveInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'usr_1',
        invitedByUserId: 'usr_admin',
        expiresAt: new Date('2026-01-04T00:00:00.000Z'),
      }),
    );
    expect(sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new.user@company.com',
        displayName: 'New User',
        invitedByDisplayName: 'Admin',
        expiresAt: new Date('2026-01-04T00:00:00.000Z'),
      }),
    );
    const emailArgs = sendInviteEmail.mock.calls[0]?.[0] as {
      inviteUrl: string;
    };
    expect(emailArgs.inviteUrl).toMatch(
      /^https:\/\/auth\.company\.com\/admin\/invite\/.+/,
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.user.invited',
        severity: AuditSeverity.INFO,
        actorUserId: 'usr_admin',
        targetUserId: 'usr_1',
      }),
    );
  });

  it('surfaces a clear error and persists nothing when the email fails to send', async () => {
    findUser.mockResolvedValue({
      id: 'usr_1',
      email: 'new.user@company.com',
      displayName: 'New User',
      status: UserStatus.PENDING,
    });
    sendInviteEmail.mockRejectedValueOnce(
      new Error('You can only send testing emails to your own address.'),
    );

    await expect(service.createInvite('usr_1', context)).rejects.toThrow(
      'Could not send the invite email: You can only send testing emails to your own address.',
    );
    expect(updateInvites).not.toHaveBeenCalled();
    expect(saveInvite).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
