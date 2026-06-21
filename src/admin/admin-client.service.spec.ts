import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminClientService } from './admin-client.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import {
  OidcClientStatus,
  OidcClientType,
} from '../database/entities/oidc-client.entity';

describe('AdminClientService', () => {
  const findClient = vi.fn();
  const createClient = vi.fn((input: unknown) => input);
  const saveClient = vi.fn((input: { id?: string }) =>
    Promise.resolve({
      ...input,
      id: input.id ?? 'cli_created',
    }),
  );
  const findRedirectUri = vi.fn();
  const createRedirectUri = vi.fn((input: unknown) => input);
  const saveRedirectUri = vi.fn((input: { id?: string }) =>
    Promise.resolve({
      ...input,
      id: input.id ?? 'rdu_created',
    }),
  );
  const removeRedirectUri = vi.fn(() => Promise.resolve());
  const record = vi.fn<(input: unknown) => Promise<string>>(() =>
    Promise.resolve('evt_123'),
  );
  const service = new AdminClientService(
    {
      findOne: findClient,
      create: createClient,
      save: saveClient,
    } as never,
    {
      findOne: findRedirectUri,
      create: createRedirectUri,
      save: saveRedirectUri,
      remove: removeRedirectUri,
    } as never,
    {
      record,
    } as never,
  );
  const context = {
    principal: {
      user: {
        id: 'usr_admin',
      },
      providerSession: {
        id: 'psn_admin',
      },
    } as never,
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
  };

  beforeEach(() => {
    findClient.mockReset();
    createClient.mockClear();
    saveClient.mockClear();
    findRedirectUri.mockReset();
    createRedirectUri.mockClear();
    saveRedirectUri.mockClear();
    removeRedirectUri.mockClear();
    record.mockClear();
  });

  it('creates active clients with normalized policy and audit events', async () => {
    findClient.mockResolvedValue(null);

    const client = await service.createClient(
      {
        clientId: ' internal-web ',
        name: ' Internal Web ',
        type: OidcClientType.PUBLIC,
        allowedScopes: ['openid', 'profile', 'profile', ' '],
        allowedClaims: ['sub', 'email', 'email'],
        allowRefreshTokens: true,
        ownerTeam: ' Platform ',
      },
      context,
    );

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'internal-web',
        name: 'Internal Web',
        type: OidcClientType.PUBLIC,
        status: OidcClientStatus.ACTIVE,
        allowedScopes: ['openid', 'profile'],
        allowedClaims: ['sub', 'email'],
        requirePkce: true,
        allowRefreshTokens: true,
        refreshTokenIdleTtlSeconds: 604800,
        refreshTokenAbsoluteTtlSeconds: 2592000,
        ownerTeam: 'Platform',
      }),
    );
    expect(client.id).toMatch(/^cli_/);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.client.created',
        severity: AuditSeverity.INFO,
        actorUserId: 'usr_admin',
        clientId: client.id,
        providerSessionId: 'psn_admin',
      }),
    );
  });

  it('rejects duplicate client IDs', async () => {
    findClient.mockResolvedValueOnce({
      id: 'cli_existing',
    });

    await expect(
      service.createClient(
        {
          clientId: 'internal-web',
          name: 'Internal Web',
        },
        context,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(saveClient).not.toHaveBeenCalled();
  });

  it('updates scopes, claims, TTLs, refresh policy, and audit events', async () => {
    findClient.mockResolvedValueOnce({
      id: 'cli_target',
      clientId: 'internal-web',
      name: 'Internal Web',
      allowedScopes: ['openid'],
      allowedClaims: ['sub'],
      requirePkce: true,
      allowRefreshTokens: false,
      accessTokenTtlSeconds: 900,
      idTokenTtlSeconds: 900,
      refreshTokenIdleTtlSeconds: null,
      refreshTokenAbsoluteTtlSeconds: null,
      ownerTeam: null,
    });

    const client = await service.updateClient(
      'cli_target',
      {
        name: 'Internal Portal',
        allowedScopes: ['openid', 'email'],
        allowedClaims: ['sub', 'email'],
        accessTokenTtlSeconds: 600,
        allowRefreshTokens: true,
        refreshTokenIdleTtlSeconds: 1200,
        refreshTokenAbsoluteTtlSeconds: 3600,
      },
      context,
    );

    expect(client).toMatchObject({
      id: 'cli_target',
      name: 'Internal Portal',
      allowedScopes: ['openid', 'email'],
      allowedClaims: ['sub', 'email'],
      accessTokenTtlSeconds: 600,
      allowRefreshTokens: true,
      refreshTokenIdleTtlSeconds: 1200,
      refreshTokenAbsoluteTtlSeconds: 3600,
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.client.updated',
      }),
    );
  });

  it('changes client status and audits the change', async () => {
    findClient.mockResolvedValueOnce({
      id: 'cli_target',
      clientId: 'internal-web',
      status: OidcClientStatus.ACTIVE,
    });

    await expect(
      service.setClientStatus('cli_target', OidcClientStatus.DISABLED, context),
    ).resolves.toMatchObject({
      status: OidcClientStatus.DISABLED,
    });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.client.status_changed',
      }),
    );
  });

  it('adds exact redirect URIs and audits the addition', async () => {
    findClient.mockResolvedValueOnce({
      id: 'cli_target',
      clientId: 'internal-web',
    });
    findRedirectUri.mockResolvedValueOnce(null);

    const redirectUri = await service.addRedirectUri(
      'cli_target',
      {
        uri: 'https://app.company.com/callback',
      },
      context,
    );

    expect(createRedirectUri).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'cli_target',
        uri: 'https://app.company.com/callback',
      }),
    );
    expect(redirectUri.id).toMatch(/^rdu_/);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.client.redirect_uri_added',
      }),
    );
  });

  it('rejects invalid and duplicate redirect URIs', async () => {
    findClient.mockResolvedValue({
      id: 'cli_target',
      clientId: 'internal-web',
    });

    await expect(
      service.addRedirectUri(
        'cli_target',
        {
          uri: 'https://app.company.com/callback#token',
        },
        context,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    findRedirectUri.mockResolvedValueOnce({
      id: 'rdu_existing',
    });

    await expect(
      service.addRedirectUri(
        'cli_target',
        {
          uri: 'https://app.company.com/callback',
        },
        context,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('removes redirect URIs and rejects missing redirect URIs', async () => {
    const redirectUri = {
      id: 'rdu_target',
      clientId: 'cli_target',
      uri: 'https://app.company.com/callback',
    };
    findClient.mockResolvedValue({
      id: 'cli_target',
      clientId: 'internal-web',
    });
    findRedirectUri.mockResolvedValueOnce(redirectUri);

    await expect(
      service.removeRedirectUri('cli_target', 'rdu_target', context),
    ).resolves.toBeUndefined();

    expect(removeRedirectUri).toHaveBeenCalledWith(redirectUri);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin.client.redirect_uri_removed',
      }),
    );

    findRedirectUri.mockResolvedValueOnce(null);

    await expect(
      service.removeRedirectUri('cli_target', 'rdu_missing', context),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
