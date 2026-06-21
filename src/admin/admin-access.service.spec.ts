import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { AdminAccessService } from './admin-access.service';
import { UserStatus } from '../database/entities/user.entity';

describe('AdminAccessService', () => {
  const now = new Date('2026-06-21T12:00:00.000Z');
  const findUser = vi.fn();
  const findGroup = vi.fn();
  const findMembership = vi.fn();
  const findProviderSession = vi.fn();
  const service = new AdminAccessService(
    {
      getOrThrow: vi.fn(() => 'internal-id-admins'),
    } as unknown as ConfigService,
    { findOne: findUser } as never,
    { findOne: findGroup } as never,
    { findOne: findMembership } as never,
    { findOne: findProviderSession } as never,
  );

  beforeEach(() => {
    findUser.mockReset();
    findGroup.mockReset();
    findMembership.mockReset();
    findProviderSession.mockReset();

    findProviderSession.mockResolvedValue({
      id: 'psn_123',
      userId: 'usr_123',
      revokedAt: null,
      idleExpiresAt: new Date('2026-06-21T13:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-06-22T12:00:00.000Z'),
    });
    findUser.mockResolvedValue({
      id: 'usr_123',
      status: UserStatus.ACTIVE,
      displayName: 'Internal Admin',
    });
    findGroup.mockResolvedValue({
      id: 'grp_123',
      slug: 'internal-id-admins',
    });
    findMembership.mockResolvedValue({
      userId: 'usr_123',
      groupId: 'grp_123',
    });
  });

  it('returns the active admin principal', async () => {
    await expect(
      service.requireAdminAccess({
        providerSessionToken: 'session-token',
        now,
      }),
    ).resolves.toMatchObject({
      user: {
        id: 'usr_123',
      },
      providerSession: {
        id: 'psn_123',
      },
    });

    expect(findProviderSession).toHaveBeenCalledWith({
      where: {
        sessionHash: createHash('sha256').update('session-token').digest('hex'),
      },
    });
  });

  it('rejects missing provider session cookies', async () => {
    await expect(
      service.requireAdminAccess({
        providerSessionToken: null,
        now,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects expired provider sessions', async () => {
    findProviderSession.mockResolvedValueOnce({
      id: 'psn_123',
      userId: 'usr_123',
      revokedAt: null,
      idleExpiresAt: new Date('2026-06-21T11:59:59.000Z'),
      absoluteExpiresAt: new Date('2026-06-22T12:00:00.000Z'),
    });

    await expect(
      service.requireAdminAccess({
        providerSessionToken: 'session-token',
        now,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects inactive users', async () => {
    findUser.mockResolvedValueOnce({
      id: 'usr_123',
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.requireAdminAccess({
        providerSessionToken: 'session-token',
        now,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects users outside the admin group', async () => {
    findMembership.mockResolvedValueOnce(null);

    await expect(
      service.requireAdminAccess({
        providerSessionToken: 'session-token',
        now,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
