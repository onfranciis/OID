import { describe, expect, it, vi } from 'vitest';
import { OidcClientStatus } from '../database/entities/oidc-client.entity';
import { AdminController } from './admin.controller';
import type { AdminAuditService } from './admin-audit.service';
import type { AdminClientService } from './admin-client.service';
import type { AdminCsrfService } from './admin-csrf.service';
import type { AdminGroupService } from './admin-group.service';
import type { AdminPageService } from './admin-page.service';
import type { AdminUserService } from './admin-user.service';

describe('AdminController', () => {
  const rotateClientSecret = vi.fn<AdminClientService['rotateClientSecret']>();
  const setClientStatus = vi.fn<AdminClientService['setClientStatus']>();
  const controller = new AdminController(
    {
      renderIndex: vi.fn(),
    } as unknown as AdminPageService,
    {
      listRecent: vi.fn(),
    } as unknown as AdminAuditService,
    {
      rotateClientSecret,
      setClientStatus,
    } as unknown as AdminClientService,
    {
      generateToken: vi.fn(),
      buildCookieHeader: vi.fn(),
    } as unknown as AdminCsrfService,
    {} as AdminGroupService,
    {} as AdminUserService,
  );

  it('delegates client secret rotation with admin mutation context', async () => {
    rotateClientSecret.mockResolvedValueOnce({
      clientId: 'internal-web',
      clientSecret: 'oidc_secret_once',
    });

    await expect(
      controller.rotateClientSecret(adminRequest(), 'cli_target'),
    ).resolves.toEqual({
      clientId: 'internal-web',
      clientSecret: 'oidc_secret_once',
    });

    expect(rotateClientSecret).toHaveBeenCalledWith('cli_target', {
      principal: {
        user: {
          id: 'usr_admin',
          displayName: 'Admin User',
        },
        providerSession: {
          id: 'psn_admin',
        },
      },
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
  });

  it('delegates client status changes with the same mutation context', async () => {
    setClientStatus.mockResolvedValueOnce({
      id: 'cli_target',
      status: OidcClientStatus.DISABLED,
    } as never);

    await expect(
      controller.setClientStatus(
        adminRequest(),
        'cli_target',
        OidcClientStatus.DISABLED,
      ),
    ).resolves.toMatchObject({
      status: OidcClientStatus.DISABLED,
    });

    expect(setClientStatus).toHaveBeenCalledWith(
      'cli_target',
      OidcClientStatus.DISABLED,
      expect.objectContaining({
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      }),
    );
  });
});

function adminRequest() {
  return {
    adminPrincipal: {
      user: {
        id: 'usr_admin',
        displayName: 'Admin User',
      },
      providerSession: {
        id: 'psn_admin',
      },
    },
    ip: '127.0.0.1',
    get: vi.fn(() => 'vitest'),
  } as never;
}
