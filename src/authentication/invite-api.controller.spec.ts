import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { InviteApiController } from './invite-api.controller';
import type { InviteAcceptService } from './invite-accept.service';

describe('InviteApiController', () => {
  function makeController(overrides: Partial<InviteAcceptService>) {
    return new InviteApiController(overrides as InviteAcceptService);
  }

  it('returns the invite summary for GET :token', async () => {
    const getInvite = vi
      .fn()
      .mockResolvedValue({ email: 'a@company.com', displayName: 'Ann' });
    const controller = makeController({ getInvite });

    await expect(controller.getInvite('raw-token')).resolves.toEqual({
      email: 'a@company.com',
      displayName: 'Ann',
    });
    expect(getInvite).toHaveBeenCalledWith('raw-token');
  });

  it('accepts the invite with the request ip/user-agent as context', async () => {
    const accept = vi.fn().mockResolvedValue(undefined);
    const controller = makeController({ accept });

    const result = await controller.accept(
      'raw-token',
      { password: 'a-good-password' },
      { ip: '127.0.0.1', get: () => 'vitest' } as unknown as Request,
    );

    expect(result).toEqual({ success: true });
    expect(accept).toHaveBeenCalledWith('raw-token', 'a-good-password', {
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
  });
});
