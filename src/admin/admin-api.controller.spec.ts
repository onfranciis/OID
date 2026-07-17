import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { AppConfigService } from '../config/app-config.service';
import type { AdminPrincipal } from './admin-access.service';
import { AdminApiController } from './admin-api.controller';
import type { AdminAuditService } from './admin-audit.service';
import type { AdminClientService } from './admin-client.service';
import type { AdminCsrfService } from './admin-csrf.service';
import type { AdminGroupService } from './admin-group.service';
import type { AdminUserService } from './admin-user.service';

const CREATED = new Date('2026-01-02T03:04:05.000Z');

function makeController(overrides: {
  audit?: Partial<AdminAuditService>;
  client?: Partial<AdminClientService>;
  csrf?: Partial<AdminCsrfService>;
  group?: Partial<AdminGroupService>;
  user?: Partial<AdminUserService>;
}) {
  return new AdminApiController(
    {
      get: vi.fn().mockReturnValue('internal-id-admins'),
    } as unknown as AppConfigService,
    (overrides.audit ?? {}) as AdminAuditService,
    (overrides.client ?? {}) as AdminClientService,
    (overrides.csrf ?? {}) as AdminCsrfService,
    (overrides.group ?? {}) as AdminGroupService,
    (overrides.user ?? {}) as AdminUserService,
  );
}

function adminRequest(): Request & { adminPrincipal: AdminPrincipal } {
  return {
    adminPrincipal: {
      user: {
        id: 'usr_admin',
        displayName: 'Admin',
        email: 'admin@company.com',
      },
      providerSession: { id: 'psn_admin' },
    },
    ip: '127.0.0.1',
    get: () => 'vitest',
  } as unknown as Request & { adminPrincipal: AdminPrincipal };
}

describe('AdminApiController', () => {
  it('returns identity, a fresh CSRF token, and the admin group slug', () => {
    const setHeader = vi.fn();
    const controller = makeController({
      csrf: {
        generateToken: vi.fn().mockReturnValue('nonce.sig'),
        buildCookieHeader: vi.fn().mockReturnValue('cookie'),
      },
    });

    const result = controller.getSession(adminRequest(), {
      setHeader,
    } as unknown as Response);

    expect(result).toEqual({
      user: {
        id: 'usr_admin',
        displayName: 'Admin',
        email: 'admin@company.com',
      },
      isAdmin: true,
      csrfToken: 'nonce.sig',
      adminGroupSlug: 'internal-id-admins',
    });
    expect(setHeader).toHaveBeenCalledWith('set-cookie', 'cookie');
  });

  it('maps the user list to summaries and passes the cursor page through', async () => {
    const listUsers = vi.fn().mockResolvedValue({
      items: [
        {
          id: 'usr_1',
          email: 'a@company.com',
          username: 'ann',
          displayName: 'Ann',
          profileType: 'employee',
          status: 'active',
          createdAt: CREATED,
        },
      ],
      nextCursor: 'usr_1',
    });
    const controller = makeController({
      user: { listUsers },
    });

    const result = await controller.listUsers(
      undefined,
      '20',
      undefined,
      'ann',
    );

    expect(listUsers).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 20,
      status: undefined,
      q: 'ann',
    });
    expect(result.nextCursor).toBe('usr_1');
    expect(result.items[0]).toMatchObject({ id: 'usr_1', displayName: 'Ann' });
  });

  it('composes user detail from the user and their groups', async () => {
    const controller = makeController({
      user: {
        getUserById: vi.fn().mockResolvedValue({
          id: 'usr_1',
          email: 'a@company.com',
          username: 'ann',
          displayName: 'Ann',
          givenName: null,
          familyName: null,
          emailVerifiedAt: null,
          profileType: 'employee',
          status: 'active',
          createdAt: CREATED,
          updatedAt: CREATED,
          deactivatedAt: null,
        }),
      },
      group: {
        getGroupsForUser: vi
          .fn()
          .mockResolvedValue([
            { id: 'grp_1', slug: 'eng', displayName: 'Engineering' },
          ]),
      },
    });

    const result = await controller.getUser('usr_1');

    expect(result.groups).toEqual([
      { id: 'grp_1', slug: 'eng', displayName: 'Engineering' },
    ]);
  });

  it('wraps a status change as { user } after re-fetching detail', async () => {
    const setUserStatus = vi.fn().mockResolvedValue(undefined);
    const controller = makeController({
      user: {
        setUserStatus,
        getUserById: vi.fn().mockResolvedValue({
          id: 'usr_1',
          email: 'a@company.com',
          username: null,
          displayName: 'Ann',
          givenName: null,
          familyName: null,
          emailVerifiedAt: null,
          profileType: 'employee',
          status: 'suspended',
          createdAt: CREATED,
          updatedAt: CREATED,
          deactivatedAt: null,
        }),
      },
      group: {
        getGroupsForUser: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await controller.setUserStatus(
      adminRequest(),
      'usr_1',
      'suspended' as never,
    );

    expect(setUserStatus).toHaveBeenCalledWith(
      'usr_1',
      'suspended',
      expect.objectContaining({ ipAddress: '127.0.0.1', userAgent: 'vitest' }),
    );
    expect(result.user.status).toBe('suspended');
  });

  it('maps audit events, renaming metadataJson to metadata, and forwards the cursor page', async () => {
    const controller = makeController({
      audit: {
        listRecent: vi.fn().mockResolvedValue({
          items: [
            {
              id: 'aud_1',
              eventType: 'admin.user.created',
              severity: 'info',
              actorUserId: 'usr_admin',
              targetUserId: 'usr_1',
              clientId: null,
              providerSessionId: null,
              ipAddress: null,
              userAgent: null,
              metadataJson: { status: 'pending' },
              createdAt: CREATED,
            },
          ],
          nextCursor: 'aud_1',
        }),
      },
    });

    const result = await controller.listAuditEvents({});

    expect(result.nextCursor).toBe('aud_1');
    expect(result.items[0]).toMatchObject({
      id: 'aud_1',
      metadata: { status: 'pending' },
    });
    expect(result.items[0]).not.toHaveProperty('metadataJson');
  });
});
