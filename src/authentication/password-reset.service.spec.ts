import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../config/app-config.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { UserStatus } from '../database/entities/user.entity';
import { PasswordResetService } from './password-reset.service';

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

describe('PasswordResetService', () => {
  const findUser = vi.fn();
  const findReset = vi.fn();
  const updateResets = vi.fn<
    (criteria: unknown, partial: unknown) => Promise<{ affected: number }>
  >(() => Promise.resolve({ affected: 0 }));
  const createReset = vi.fn((input: unknown) => input);
  const saveReset = vi.fn<(input: unknown) => Promise<unknown>>((input) =>
    Promise.resolve(input),
  );
  const updateProviderSessions = vi.fn<
    (criteria: unknown, partial: unknown) => Promise<{ affected: number }>
  >(() => Promise.resolve({ affected: 0 }));
  const updateRefreshTokens = vi.fn<
    (criteria: unknown, partial: unknown) => Promise<{ affected: number }>
  >(() => Promise.resolve({ affected: 0 }));
  const sendPasswordResetEmail = vi.fn<(input: unknown) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const record = vi.fn<(input: unknown) => Promise<string>>(() =>
    Promise.resolve('evt_123'),
  );
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'mail.passwordResetTtlHours') return 1;
      if (key === 'app.baseUrl') return 'https://auth.company.com';
      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as unknown as AppConfigService;
  const service = new PasswordResetService(
    {} as never,
    {
      findOne: findReset,
      create: createReset,
      save: saveReset,
      update: updateResets,
    } as never,
    { findOne: findUser } as never,
    { update: updateProviderSessions } as never,
    { update: updateRefreshTokens } as never,
    { sendPasswordResetEmail } as never,
    { record } as never,
    configService,
  );
  const context = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

  beforeEach(() => {
    findUser.mockReset();
    findReset.mockReset();
    updateResets.mockClear();
    createReset.mockClear();
    saveReset.mockClear();
    updateProviderSessions.mockClear();
    updateRefreshTokens.mockClear();
    sendPasswordResetEmail.mockClear();
    record.mockClear();
    upsertBetterAuthCredential.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  function validReset() {
    return {
      id: 'pwr_1',
      userId: 'usr_1',
      tokenHash: hashToken('raw-token'),
      expiresAt: new Date('2026-01-01T01:00:00.000Z'),
      consumedAt: null,
      revokedAt: null,
      user: {
        id: 'usr_1',
        email: 'user@company.com',
        displayName: 'A User',
        status: UserStatus.ACTIVE,
      },
    };
  }

  describe('requestReset', () => {
    it('is a silent no-op for an unknown email', async () => {
      findUser.mockResolvedValue(null);

      await service.requestReset('nobody@company.com', context);

      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(saveReset).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    });

    it('is a silent no-op for a non-active user', async () => {
      findUser.mockResolvedValue({
        id: 'usr_1',
        email: 'user@company.com',
        displayName: 'A User',
        status: UserStatus.SUSPENDED,
      });

      await service.requestReset('user@company.com', context);

      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('supersedes outstanding resets, emails the link, and audits the request', async () => {
      findUser.mockResolvedValue({
        id: 'usr_1',
        email: 'user@company.com',
        displayName: 'A User',
        status: UserStatus.ACTIVE,
      });

      await service.requestReset('user@company.com', context);

      expect(updateResets).toHaveBeenCalledTimes(1);
      const [criteria, patch] = updateResets.mock.calls[0] ?? [];
      expect(criteria).toMatchObject({ userId: 'usr_1' });
      expect((patch as { revokedAt: Date }).revokedAt).toBeInstanceOf(Date);
      expect(saveReset).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr_1',
          expiresAt: new Date('2026-01-01T01:00:00.000Z'),
        }),
      );
      const emailArgs = sendPasswordResetEmail.mock.calls[0]?.[0] as {
        resetUrl: string;
      };
      expect(emailArgs.resetUrl).toMatch(
        /^https:\/\/auth\.company\.com\/admin\/reset-password\/.+/,
      );
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.password_reset.requested',
          severity: AuditSeverity.INFO,
          actorUserId: 'usr_1',
          targetUserId: 'usr_1',
        }),
      );
    });

    it('logs and swallows a mail-send failure without persisting anything', async () => {
      findUser.mockResolvedValue({
        id: 'usr_1',
        email: 'user@company.com',
        displayName: 'A User',
        status: UserStatus.ACTIVE,
      });
      sendPasswordResetEmail.mockRejectedValueOnce(new Error('mail down'));

      await expect(
        service.requestReset('user@company.com', context),
      ).resolves.toBeUndefined();
      expect(updateResets).not.toHaveBeenCalled();
      expect(saveReset).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    });
  });

  describe('getReset', () => {
    it('rejects an unknown token', async () => {
      findReset.mockResolvedValue(null);

      await expect(service.getReset('bogus')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects an empty token without querying the repository', async () => {
      await expect(service.getReset('')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(findReset).not.toHaveBeenCalled();
    });

    it('rejects an expired reset', async () => {
      findReset.mockResolvedValue({
        ...validReset(),
        expiresAt: new Date('2025-12-31T00:00:00.000Z'),
      });

      await expect(service.getReset('raw-token')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects an already-consumed reset', async () => {
      findReset.mockResolvedValue({
        ...validReset(),
        consumedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      await expect(service.getReset('raw-token')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a revoked reset', async () => {
      findReset.mockResolvedValue({
        ...validReset(),
        revokedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      await expect(service.getReset('raw-token')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a reset for a user who is no longer active', async () => {
      findReset.mockResolvedValue({
        ...validReset(),
        user: { ...validReset().user, status: UserStatus.SUSPENDED },
      });

      await expect(service.getReset('raw-token')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the account email for a valid reset', async () => {
      findReset.mockResolvedValue(validReset());

      await expect(service.getReset('raw-token')).resolves.toEqual({
        email: 'user@company.com',
      });
    });
  });

  describe('resetPassword', () => {
    it('rejects a password shorter than 8 characters', async () => {
      findReset.mockResolvedValue(validReset());

      await expect(
        service.resetPassword('raw-token', 'short', context),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(upsertBetterAuthCredential).not.toHaveBeenCalled();
    });

    it('provisions the credential, consumes the reset, revokes sessions, and audits it', async () => {
      findReset.mockResolvedValue(validReset());

      await service.resetPassword('raw-token', 'a-good-password', context);

      expect(upsertBetterAuthCredential).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          userId: 'usr_1',
          email: 'user@company.com',
          displayName: 'A User',
          password: 'a-good-password',
        }),
      );
      expect(saveReset).toHaveBeenCalledTimes(1);
      const [savedReset] = saveReset.mock.calls[0] ?? [];
      expect((savedReset as { consumedAt: Date }).consumedAt).toBeInstanceOf(
        Date,
      );
      expect(updateProviderSessions).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'usr_1' }),
        expect.objectContaining({ revocationReason: 'password_reset' }),
      );
      expect(updateRefreshTokens).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'usr_1' }),
        expect.objectContaining({ revocationReason: 'password_reset' }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.password_reset.completed',
          severity: AuditSeverity.INFO,
          actorUserId: 'usr_1',
          targetUserId: 'usr_1',
        }),
      );
    });
  });
});
