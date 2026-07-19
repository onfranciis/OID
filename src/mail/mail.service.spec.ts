import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../config/app-config.service';
import { MailService } from './mail.service';

const send = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function MockResend(this: unknown) {
    Object.assign(this as object, { emails: { send } });
  }),
}));

describe('MailService', () => {
  const invite = {
    to: 'newuser@company.com',
    displayName: 'New User',
    invitedByDisplayName: 'Internal ID Administrator',
    inviteUrl: 'https://auth.company.com/admin/invite/raw-token',
    expiresAt: new Date('2026-01-04T00:00:00.000Z'),
  };

  beforeEach(() => {
    send.mockReset();
  });

  function makeConfigService(resendApiKey: string | null) {
    return {
      get: vi.fn((key: string) => {
        if (key === 'mail.resendApiKey') return resendApiKey;
        if (key === 'mail.fromEmail')
          return 'Internal ID <onboarding@resend.dev>';
        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as AppConfigService;
  }

  it('sends via Resend when an API key is configured', async () => {
    send.mockResolvedValue({ data: { id: 'email_123' }, error: null });
    const service = new MailService(makeConfigService('re_test_key'));

    await service.sendInviteEmail(invite);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Internal ID <onboarding@resend.dev>',
        to: invite.to,
        subject: "You're invited to Internal ID",
      }),
    );
    const call = send.mock.calls[0]?.[0] as { html: string; text: string };
    expect(call.html).toContain(invite.inviteUrl);
    expect(call.text).toContain(invite.inviteUrl);
  });

  it('throws when Resend reports an error', async () => {
    send.mockResolvedValue({
      data: null,
      error: { message: 'invalid from address', name: 'validation_error' },
    });
    const service = new MailService(makeConfigService('re_test_key'));

    await expect(service.sendInviteEmail(invite)).rejects.toThrow(
      /invalid from address/,
    );
  });

  it('falls back to logging the invite link when no API key is configured', async () => {
    const service = new MailService(makeConfigService(null));

    await expect(service.sendInviteEmail(invite)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});
