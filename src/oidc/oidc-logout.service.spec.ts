import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticationService } from '../authentication/authentication.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { AppConfigService } from '../config/app-config.service';
import { OidcLogoutService } from './oidc-logout.service';
import type { OidcTokenService } from './oidc-token.service';

describe('OidcLogoutService', () => {
  const findClient = vi.fn();
  const findRedirectUri = vi.fn();
  const verifyIdTokenHint = vi.fn<OidcTokenService['verifyIdTokenHint']>();
  const logout = vi.fn<AuthenticationService['logout']>();
  const record = vi.fn<(input: unknown) => Promise<string>>(() =>
    Promise.resolve('evt_123'),
  );
  const service = new OidcLogoutService(
    {
      get: vi.fn((key: string) => {
        if (key === 'betterAuth.loginPath') {
          return '/admin/login';
        }

        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as AppConfigService,
    { findOne: findClient } as never,
    { findOne: findRedirectUri } as never,
    { verifyIdTokenHint } as never,
    { logout } as never,
    { record } as never,
  );
  const context = {
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    headers: {},
    cookies: { internal_id_provider_session: 'session-token' },
  };

  beforeEach(() => {
    findClient.mockReset();
    findRedirectUri.mockReset();
    verifyIdTokenHint.mockReset();
    logout.mockReset();
    record.mockClear();
    logout.mockResolvedValue({
      responseHeaders: ['internal_id_provider_session=; Max-Age=0'],
    });
  });

  it('falls back to the login page when no post_logout_redirect_uri is given', async () => {
    const result = await service.endSession({ ...context });

    expect(result).toEqual({
      redirectTo: '/admin/login',
      responseHeaders: ['internal_id_provider_session=; Max-Age=0'],
    });
    expect(findClient).not.toHaveBeenCalled();
    expect(logout).toHaveBeenCalledWith(context);
  });

  it('redirects to a registered post_logout_redirect_uri resolved from an explicit client_id', async () => {
    findClient.mockResolvedValue({ id: 'cli_123', clientId: 'internal-web' });
    findRedirectUri.mockResolvedValue({
      id: 'plr_1',
      clientId: 'cli_123',
      uri: 'https://app.company.com/logout/callback',
    });

    const result = await service.endSession({
      ...context,
      clientId: 'internal-web',
      postLogoutRedirectUri: 'https://app.company.com/logout/callback',
      state: 'state_123',
    });

    expect(findClient).toHaveBeenCalledWith({
      where: { clientId: 'internal-web' },
    });
    expect(findRedirectUri).toHaveBeenCalledWith({
      where: {
        clientId: 'cli_123',
        uri: 'https://app.company.com/logout/callback',
      },
    });
    expect(result.redirectTo).toBe(
      'https://app.company.com/logout/callback?state=state_123',
    );
  });

  it('derives the client from a verified id_token_hint when client_id is omitted', async () => {
    verifyIdTokenHint.mockResolvedValue({ sub: 'usr_1', aud: 'internal-web' });
    findClient.mockResolvedValue({ id: 'cli_123', clientId: 'internal-web' });
    findRedirectUri.mockResolvedValue({
      id: 'plr_1',
      clientId: 'cli_123',
      uri: 'https://app.company.com/logout/callback',
    });

    const result = await service.endSession({
      ...context,
      idTokenHint: 'id-token',
      postLogoutRedirectUri: 'https://app.company.com/logout/callback',
    });

    expect(verifyIdTokenHint).toHaveBeenCalledWith('id-token');
    expect(result.redirectTo).toBe('https://app.company.com/logout/callback');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oidc.end_session.succeeded',
        severity: AuditSeverity.INFO,
        targetUserId: 'usr_1',
      }),
    );
  });

  it('ignores an unregistered post_logout_redirect_uri and falls back to login', async () => {
    findClient.mockResolvedValue({ id: 'cli_123', clientId: 'internal-web' });
    findRedirectUri.mockResolvedValue(null);

    const result = await service.endSession({
      ...context,
      clientId: 'internal-web',
      postLogoutRedirectUri: 'https://evil.example/steal',
    });

    expect(result.redirectTo).toBe('/admin/login');
  });

  it('ignores post_logout_redirect_uri when the client cannot be resolved (no client_id, unverifiable hint)', async () => {
    verifyIdTokenHint.mockResolvedValue(null);

    const result = await service.endSession({
      ...context,
      idTokenHint: 'garbage',
      postLogoutRedirectUri: 'https://app.company.com/logout/callback',
    });

    expect(findClient).not.toHaveBeenCalled();
    expect(result.redirectTo).toBe('/admin/login');
  });

  it('always terminates the local session even when the redirect target is rejected', async () => {
    findClient.mockResolvedValue(null);

    await service.endSession({
      ...context,
      clientId: 'unknown-client',
      postLogoutRedirectUri: 'https://evil.example/steal',
    });

    expect(logout).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: '127.0.0.1',
        cookies: { internal_id_provider_session: 'session-token' },
      }),
    );
  });
});
