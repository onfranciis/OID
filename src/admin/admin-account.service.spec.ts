import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditEventTypes } from '../audit/audit.types';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { AdminAccountService } from './admin-account.service';

describe('AdminAccountService', () => {
  const changePassword = vi.fn();
  const record = vi.fn<(input: unknown) => Promise<string>>(() =>
    Promise.resolve('evt_123'),
  );
  const service = new AdminAccountService(
    { changePassword } as never,
    { record } as never,
  );
  const context = {
    principal: {
      user: { id: 'usr_admin' },
      providerSession: { id: 'psn_admin' },
    } as never,
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
  };

  beforeEach(() => {
    changePassword.mockReset();
    record.mockClear();
  });

  it('forwards the cookie header and records an audit event on success', async () => {
    changePassword.mockResolvedValue({ ok: true });

    await service.changePassword(
      {
        currentPassword: 'old-pass',
        newPassword: 'new-password-123',
        cookieHeader: 'internal_id_session=sess-token',
      },
      context,
    );

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'old-pass',
      newPassword: 'new-password-123',
      cookieHeader: 'internal_id_session=sess-token',
    });
    expect(record).toHaveBeenCalledWith({
      eventType: AuditEventTypes.AdminAccountPasswordChanged,
      severity: AuditSeverity.INFO,
      actorUserId: 'usr_admin',
      targetUserId: 'usr_admin',
      providerSessionId: 'psn_admin',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
  });

  it('surfaces the better-auth error message and skips the audit event on failure', async () => {
    changePassword.mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          message: 'Invalid password',
          code: 'INVALID_PASSWORD',
        }),
    });

    await expect(
      service.changePassword(
        { currentPassword: 'wrong-pass', newPassword: 'new-password-123' },
        context,
      ),
    ).rejects.toThrow(new BadRequestException('Invalid password'));
    expect(record).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the error body has no message', async () => {
    changePassword.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(
      service.changePassword(
        { currentPassword: 'wrong-pass', newPassword: 'new-password-123' },
        context,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Could not change your password. Check your current password and try again.',
      ),
    );
  });

  it('rejects empty passwords before calling better-auth', async () => {
    await expect(
      service.changePassword(
        { currentPassword: '', newPassword: 'new-password-123' },
        context,
      ),
    ).rejects.toThrow(new BadRequestException('currentPassword is required.'));
    expect(changePassword).not.toHaveBeenCalled();
  });
});
