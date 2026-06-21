import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OidcController } from './oidc.controller';
import type { OidcAuthorizationService } from './oidc-authorization.service';
import type { OidcTokenService } from './oidc-token.service';

describe('OidcController', () => {
  const authorize = vi.fn<OidcAuthorizationService['authorize']>();
  const jwks = vi.fn<OidcTokenService['jwks']>();
  const exchangeAuthorizationCode =
    vi.fn<OidcTokenService['exchangeAuthorizationCode']>();
  const userInfo = vi.fn<OidcTokenService['userInfo']>();
  const controller = new OidcController(
    {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'app.baseUrl') {
          return 'https://auth.company.com';
        }

        if (key === 'authentication.providerSessionCookieName') {
          return 'internal_id_provider_session';
        }

        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as ConfigService,
    {
      authorize,
    } as never,
    {
      jwks,
      exchangeAuthorizationCode,
      userInfo,
    } as never,
  );

  beforeEach(() => {
    authorize.mockReset();
    authorize.mockResolvedValue({
      redirectTo: 'https://app.company.com/callback?code=abc&state=state_123',
    });
  });

  it('returns constrained discovery metadata', () => {
    expect(controller.discovery()).toMatchObject({
      issuer: 'https://auth.company.com',
      authorization_endpoint: 'https://auth.company.com/oauth/authorize',
      token_endpoint: 'https://auth.company.com/oauth/token',
      response_types_supported: ['code'],
      code_challenge_methods_supported: ['S256'],
    });
  });

  it('passes authorize requests to the service and redirects', async () => {
    const redirect = vi.fn();

    await controller.authorize(
      {
        response_type: 'code',
        client_id: 'internal-web',
        redirect_uri: 'https://app.company.com/callback',
        scope: 'openid',
        state: 'state_123',
        code_challenge: 'challenge_123',
        code_challenge_method: 'S256',
      },
      {
        headers: {
          cookie: 'internal_id_provider_session=session-token',
        },
        originalUrl: '/oauth/authorize?client_id=internal-web',
        ip: '127.0.0.1',
        get: vi.fn(() => 'vitest'),
      } as never,
      {
        redirect,
      } as never,
    );

    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        responseType: 'code',
        clientId: 'internal-web',
        providerSessionToken: 'session-token',
        originalUrl: '/oauth/authorize?client_id=internal-web',
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      }),
    );
    expect(redirect).toHaveBeenCalledWith(
      'https://app.company.com/callback?code=abc&state=state_123',
    );
  });
});
