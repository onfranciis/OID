import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { UserStatus } from '../database/entities/user.entity';
import { InviteAcceptService } from './invite-accept.service';

const upsertBetterAuthCredential = vi.fn<(...args: unknown[]) => Promise<void>>(
  () => Promise.resolve(),
);

vi.mock('../better-auth/better-auth-credential', () => ({
  upsertBetterAuthCredential: (...args: unknown[]) =>
    upsertBetterAuthCredential(...args),
}));

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('InviteAcceptService', () => {
  const findInvite = vi.fn();
  const saveInvite = vi.fn<(input: unknown) => Promise<unknown>>((input) =>
    Promise.resolve(input),
  );
  const saveUser = vi.fn<(input: unknown) => Promise<unknown>>((input) =>
    Promise.resolve(input),
  );
  const record = vi.fn<(input: unknown) => Promise<string>>(() =>
    Promise.resolve('evt_123'),
  );
  const service = new InviteAcceptService(
    {} as never,
    { findOne: findInvite, save: saveInvite } as never,
    { save: saveUser } as never,
    { record } as never,
  );
  const context = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

  beforeEach(() => {
    findInvite.mockReset();
    saveInvite.mockClear();
    saveUser.mockClear();
    record.mockClear();
    upsertBetterAuthCredential.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  function validInvite() {
    return {
      id: 'inv_1',
      userId: 'usr_1',
      tokenHash: hashToken('raw-token'),
      expiresAt: new Date('2026-01-04T00:00:00.000Z'),
      consumedAt: null,
      revokedAt: null,
      user: {
        id: 'usr_1',
        email: 'new.user@company.com',
        displayName: 'New User',
        status: UserStatus.PENDING,
        emailVerifiedAt: null,
      },
    };
  }

  it('rejects an unknown token', async () => {
    findInvite.mockResolvedValue(null);

    await expect(service.getInvite('bogus')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects an empty token without querying the repository', async () => {
    await expect(service.getInvite('')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findInvite).not.toHaveBeenCalled();
  });

  it('rejects an expired invite', async () => {
    findInvite.mockResolvedValue({
      ...validInvite(),
      expiresAt: new Date('2025-12-31T00:00:00.000Z'),
    });

    await expect(service.getInvite('raw-token')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects an already-consumed invite', async () => {
    findInvite.mockResolvedValue({
      ...validInvite(),
      consumedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(service.getInvite('raw-token')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects a revoked invite', async () => {
    findInvite.mockResolvedValue({
      ...validInvite(),
      revokedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(service.getInvite('raw-token')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns the invitee identity for a valid invite', async () => {
    findInvite.mockResolvedValue(validInvite());

    await expect(service.getInvite('raw-token')).resolves.toEqual({
      email: 'new.user@company.com',
      displayName: 'New User',
    });
  });

  it('rejects a password shorter than 8 characters', async () => {
    findInvite.mockResolvedValue(validInvite());

    await expect(
      service.accept('raw-token', 'short', context),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsertBetterAuthCredential).not.toHaveBeenCalled();
  });

  it('provisions the credential, consumes the invite, activates the user, verifies the email, and audits it', async () => {
    findInvite.mockResolvedValue(validInvite());

    await service.accept('raw-token', 'a-good-password', context);

    expect(upsertBetterAuthCredential).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        userId: 'usr_1',
        email: 'new.user@company.com',
        displayName: 'New User',
        password: 'a-good-password',
      }),
    );
    expect(saveInvite).toHaveBeenCalledTimes(1);
    const [savedInvite] = saveInvite.mock.calls[0] ?? [];
    expect((savedInvite as { consumedAt: Date }).consumedAt).toBeInstanceOf(
      Date,
    );
    expect(saveUser).toHaveBeenCalledWith(
      expect.objectContaining({ status: UserStatus.ACTIVE }),
    );
    const [savedUser] = saveUser.mock.calls[0] ?? [];
    expect(
      (savedUser as { emailVerifiedAt: Date }).emailVerifiedAt,
    ).toBeInstanceOf(Date);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'user.invite.accepted',
        severity: AuditSeverity.INFO,
        actorUserId: 'usr_1',
        targetUserId: 'usr_1',
      }),
    );
  });

  it('does not touch status but still verifies the email for an already-active user', async () => {
    findInvite.mockResolvedValue({
      ...validInvite(),
      user: { ...validInvite().user, status: UserStatus.ACTIVE },
    });

    await service.accept('raw-token', 'a-good-password', context);

    expect(saveUser).toHaveBeenCalledWith(
      expect.objectContaining({ status: UserStatus.ACTIVE }),
    );
    const [savedUser] = saveUser.mock.calls[0] ?? [];
    expect(
      (savedUser as { emailVerifiedAt: Date }).emailVerifiedAt,
    ).toBeInstanceOf(Date);
  });

  it('does not re-save the user when already active with an already-verified email', async () => {
    findInvite.mockResolvedValue({
      ...validInvite(),
      user: {
        ...validInvite().user,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date('2025-06-01T00:00:00.000Z'),
      },
    });

    await service.accept('raw-token', 'a-good-password', context);

    expect(saveUser).not.toHaveBeenCalled();
  });
});
