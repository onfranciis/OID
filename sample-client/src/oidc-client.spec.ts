import { generateKeyPairSync, createSign } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  buildAuthorizationRequest,
  buildEndSessionUrl,
  createLocalSession,
  exchangeAuthorizationCode,
  parseLocalSession,
  validateIdToken,
  type DiscoveryDocument,
  type SampleClientConfig,
} from './oidc-client';

const discovery: DiscoveryDocument = {
  issuer: 'https://auth.company.com',
  authorization_endpoint: 'https://auth.company.com/oauth/authorize',
  token_endpoint: 'https://auth.company.com/oauth/token',
  revocation_endpoint: 'https://auth.company.com/oauth/revoke',
  end_session_endpoint: 'https://auth.company.com/oauth/end-session',
  jwks_uri: 'https://auth.company.com/.well-known/jwks.json',
};
const config: SampleClientConfig = {
  issuer: discovery.issuer,
  clientId: 'internal-id-sample-client',
  clientSecret: 'sample-client-secret',
  redirectUri: 'http://localhost:4000/auth/callback',
  postLogoutRedirectUri: 'http://localhost:4000/logout/callback',
  scope: 'openid profile email',
  sessionSecret: 'sample-session-secret',
};

describe('sample OIDC client', () => {
  it('builds authorization code + PKCE requests', () => {
    const request = buildAuthorizationRequest(discovery, config);
    const url = new URL(request.redirectTo);

    expect(url.origin + url.pathname).toBe(discovery.authorization_endpoint);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe(config.clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toHaveLength(43);
    expect(request.state).toHaveLength(43);
    expect(request.nonce).toHaveLength(43);
    expect(request.codeVerifier.length).toBeGreaterThan(43);
  });

  it('builds an RP-initiated logout URL hinted with the id_token', () => {
    const url = new URL(buildEndSessionUrl(discovery, config, 'the-id-token'));

    expect(url.origin + url.pathname).toBe(discovery.end_session_endpoint);
    expect(url.searchParams.get('id_token_hint')).toBe('the-id-token');
    expect(url.searchParams.get('client_id')).toBe(config.clientId);
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe(
      config.postLogoutRedirectUri,
    );
  });

  it('throws when the provider does not advertise an end_session_endpoint', () => {
    expect(() =>
      buildEndSessionUrl(
        { ...discovery, end_session_endpoint: undefined },
        config,
        'the-id-token',
      ),
    ).toThrow(/end_session_endpoint/);
  });

  it('exchanges authorization codes with client authentication and verifier', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: 'access-token',
            token_type: 'Bearer',
            expires_in: 900,
            id_token: 'id-token',
            scope: 'openid profile email',
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      exchangeAuthorizationCode(
        discovery,
        config,
        {
          code: 'code_123',
          codeVerifier: 'verifier_123',
        },
        fetchImpl,
      ),
    ).resolves.toMatchObject({
      id_token: 'id-token',
    });

    const [, requestInit] = fetchImpl.mock.calls[0];
    const body = requestInit?.body as URLSearchParams;

    expect(fetchImpl).toHaveBeenCalledWith(
      discovery.token_endpoint,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(body.get('client_secret')).toBe(config.clientSecret);
    expect(body.get('code_verifier')).toBe('verifier_123');
  });

  it('validates ID token signature and required claims', () => {
    const { idToken, jwks } = signIdToken({
      iss: discovery.issuer,
      aud: config.clientId,
      sub: 'usr_123',
      exp: 2_000_000_000,
      iat: 1_900_000_000,
      nonce: 'nonce_123',
      email: 'admin@company.com',
    });

    expect(
      validateIdToken({
        idToken,
        jwks,
        issuer: discovery.issuer,
        clientId: config.clientId,
        nonce: 'nonce_123',
        now: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toMatchObject({
      sub: 'usr_123',
      email: 'admin@company.com',
    });
  });

  it('rejects ID tokens with the wrong nonce', () => {
    const { idToken, jwks } = signIdToken({
      iss: discovery.issuer,
      aud: config.clientId,
      sub: 'usr_123',
      exp: 2_000_000_000,
      iat: 1_900_000_000,
      nonce: 'nonce_123',
    });

    expect(() =>
      validateIdToken({
        idToken,
        jwks,
        issuer: discovery.issuer,
        clientId: config.clientId,
        nonce: 'different_nonce',
        now: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toThrow(/nonce/);
  });

  it('creates signed local app sessions that reject tampering', () => {
    const session = createLocalSession(
      {
        sub: 'usr_123',
        email: 'admin@company.com',
        idToken: 'id-token',
        accessToken: 'access-token',
        expiresAt: 2_000_000_000,
      },
      config.sessionSecret,
    );

    expect(
      parseLocalSession(
        session,
        config.sessionSecret,
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    ).toMatchObject({
      sub: 'usr_123',
      email: 'admin@company.com',
    });
    expect(
      parseLocalSession(
        `${session}tampered`,
        config.sessionSecret,
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    ).toBeNull();
  });
});

function signIdToken(payload: Record<string, unknown>) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const kid = 'kid_test';
  const publicJwk = {
    ...publicKey.export({ format: 'jwk' }),
    kid,
    alg: 'RS256',
    use: 'sig',
  };
  const encodedHeader = Buffer.from(
    JSON.stringify({
      alg: 'RS256',
      typ: 'JWT',
      kid,
    }),
    'utf8',
  ).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const signer = createSign('RSA-SHA256');

  signer.update(`${encodedHeader}.${encodedPayload}`);

  return {
    idToken: `${encodedHeader}.${encodedPayload}.${signer.sign(privateKey, 'base64url')}`,
    jwks: {
      keys: [publicJwk],
    },
  };
}
