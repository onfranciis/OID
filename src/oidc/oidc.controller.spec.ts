import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../config/app-config.service';
import { OidcController } from './oidc.controller';
import type { OidcAuthorizationService } from './oidc-authorization.service';
import type { OidcTokenService } from './oidc-token.service';

describe('OidcController', () => {
  const authorize = vi.fn<OidcAuthorizationService['authorize']>();
  const jwks = vi.fn<OidcTokenService['jwks']>();
  const exchangeAuthorizationCode =
    vi.fn<OidcTokenService['exchangeAuthorizationCode']>();
  const userInfo = vi.fn<OidcTokenService['userInfo']>();
  const revokeToken = vi.fn<OidcTokenService['revokeToken']>();
  const assertAllowed = vi.fn();
  const controller = new OidcController(
    {
      get: vi.fn((key: string) => {
        if (key === 'app.baseUrl') {
          return 'https://auth.company.com';
        }

        if (key === 'authentication.providerSessionCookieName') {
          return 'internal_id_provider_session';
        }

        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as AppConfigService,
    {
      authorize,
    } as never,
    {
      jwks,
      exchangeAuthorizationCode,
      userInfo,
      revokeToken,
    } as never,
    {
      assertAllowed,
    } as never,
  );

  beforeEach(() => {
    authorize.mockReset();
    revokeToken.mockReset();
    exchangeAuthorizationCode.mockReset();
    assertAllowed.mockClear();
    authorize.mockResolvedValue({
      redirectTo: 'https://app.company.com/callback?code=abc&state=state_123',
    });
    revokeToken.mockResolvedValue(undefined);
    exchangeAuthorizationCode.mockResolvedValue({
      access_token: 'access-token',
      token_type: 'Bearer',
      expires_in: 600,
      scope: 'openid',
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

  it('passes revocation requests to the token service', async () => {
    await expect(
      controller.revoke(
        {
          token: 'refresh-token',
        },
        {
          ip: '127.0.0.1',
        } as never,
      ),
    ).resolves.toBeUndefined();

    expect(assertAllowed).toHaveBeenCalledWith('127.0.0.1');
    expect(revokeToken).toHaveBeenCalledWith({
      token: 'refresh-token',
    });
  });

  it('rate limits token requests before token exchange', async () => {
    await controller.token(
      {
        grant_type: 'authorization_code',
        code: 'code',
        client_id: 'client',
      },
      {
        ip: '127.0.0.1',
        get: vi.fn(() => 'vitest'),
      } as never,
    );

    expect(assertAllowed).toHaveBeenCalledWith('127.0.0.1');
    expect(exchangeAuthorizationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        grantType: 'authorization_code',
        code: 'code',
        clientId: 'client',
      }),
    );
  });
});
