import { expect, test, type APIRequestContext } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';

// Full backend protocol journey against a live, seeded server: admin login ->
// provisioning a throwaway public client via the same admin API the React
// console uses -> authorize+PKCE -> token exchange (no client_secret) ->
// userinfo -> RP-initiated logout -> session actually gone. Exercises the
// real HTTP stack (guards, CSRF, cookies, routing) that service-level unit
// and integration tests can't reach.
//
// Requires a live server at playwright.config.ts's baseURL with a migrated,
// seeded database (see README.md in this directory) and E2E_ADMIN_PASSWORD
// set to the bootstrap admin's password. Self-skips otherwise.

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@company.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

// Our provider session/CSRF cookies are always `Secure`. Real browsers treat
// http://localhost as a trustworthy origin and send Secure cookies there
// anyway (that's why the browser-driven web/admin/e2e suite works over plain
// HTTP) — Playwright's `request` fixture is a plain HTTP client with no such
// exemption, so it never sends them back. Managing the jar by hand sidesteps
// that entirely, independent of scheme.
class CookieJar {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly request: APIRequestContext) {}

  async get(
    url: string,
    options?: {
      params?: Record<string, string>;
      headers?: Record<string, string>;
      maxRedirects?: number;
    },
  ) {
    const response = await this.request.get(url, {
      ...options,
      headers: { ...options?.headers, cookie: this.header() },
    });
    this.absorb(response);
    return response;
  }

  async post(
    url: string,
    options?: {
      data?: unknown;
      form?: Record<string, string>;
      headers?: Record<string, string>;
      maxRedirects?: number;
    },
  ) {
    const response = await this.request.post(url, {
      ...options,
      headers: { ...options?.headers, cookie: this.header() },
    });
    this.absorb(response);
    return response;
  }

  private absorb(response: Awaited<ReturnType<APIRequestContext['get']>>) {
    for (const header of response.headersArray()) {
      if (header.name.toLowerCase() !== 'set-cookie') {
        continue;
      }

      const pair = header.value.split(';', 1)[0] ?? '';
      const separatorIndex = pair.indexOf('=');

      if (separatorIndex === -1) {
        continue;
      }

      this.cookies.set(
        pair.slice(0, separatorIndex).trim(),
        pair.slice(separatorIndex + 1).trim(),
      );
    }
  }

  private header(): string {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

test('completes login, admin client provisioning, PKCE authorize+token, userinfo, and RP-initiated logout', async ({
  request,
}) => {
  test.skip(
    ADMIN_PASSWORD === '',
    'Set E2E_ADMIN_PASSWORD (and a seeded backend) to run backend e2e.',
  );

  const jar = new CookieJar(request);

  // 1. Log in through the same JSON API the React admin console uses.
  const loginInit = await jar.get('/admin/api/auth/login');
  expect(loginInit.ok()).toBe(true);
  const { csrfToken: loginCsrfToken } = (await loginInit.json()) as {
    csrfToken: string;
  };

  const login = await jar.post('/admin/api/auth/login', {
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      csrfToken: loginCsrfToken,
    },
  });
  expect(login.ok()).toBe(true);

  // 2. Bootstrap the admin session (also mints the admin-mutation CSRF token).
  const session = await jar.get('/admin/api/session');
  expect(session.ok()).toBe(true);
  const { csrfToken: adminCsrfToken } = (await session.json()) as {
    csrfToken: string;
  };

  // 3. Provision a throwaway PUBLIC client via the admin API, rather than
  // depending on BOOTSTRAP_CLIENT_SECRET being configured in this environment.
  const redirectUri = 'https://e2e-test-client.example/callback';
  const createClient = await jar.post('/admin/api/clients', {
    headers: { 'x-csrf-token': adminCsrfToken },
    data: {
      clientId: `e2e-public-client-${Date.now()}`,
      name: 'E2E Public Client (throwaway)',
      type: 'public',
      allowedScopes: ['openid', 'email', 'profile'],
      allowedClaims: ['email'],
      requirePkce: true,
    },
  });
  expect(createClient.ok()).toBe(true);
  const client = (await createClient.json()) as {
    id: string;
    clientId: string;
  };

  const addRedirectUri = await jar.post(
    `/admin/api/clients/${client.id}/redirect-uris`,
    {
      headers: { 'x-csrf-token': adminCsrfToken },
      data: { uri: redirectUri },
    },
  );
  expect(addRedirectUri.ok()).toBe(true);

  // 4. Authorize with PKCE, using the browser session from step 1.
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  const authorize = await jar.get('/oauth/authorize', {
    params: {
      response_type: 'code',
      client_id: client.clientId,
      redirect_uri: redirectUri,
      scope: 'openid email',
      state: 'e2e-state',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    },
    maxRedirects: 0,
  });
  expect(authorize.status()).toBe(302);
  const location = new URL(authorize.headers().location ?? '', redirectUri);
  expect(`${location.origin}${location.pathname}`).toBe(redirectUri);
  expect(location.searchParams.get('state')).toBe('e2e-state');
  const code = location.searchParams.get('code');
  expect(code).toBeTruthy();

  // 5. Exchange the code for tokens — no client_secret: this is a public client.
  const tokenExchange = await jar.post('/oauth/token', {
    form: {
      grant_type: 'authorization_code',
      code: code ?? '',
      redirect_uri: redirectUri,
      client_id: client.clientId,
      code_verifier: verifier,
    },
  });
  expect(tokenExchange.ok()).toBe(true);
  const tokens = (await tokenExchange.json()) as {
    access_token: string;
    id_token?: string;
    token_type: string;
  };
  expect(tokens.token_type).toBe('Bearer');
  expect(tokens.access_token.split('.')).toHaveLength(3);
  expect(tokens.id_token?.split('.')).toHaveLength(3);

  // 6. Userinfo with the freshly issued access token.
  const userInfo = await jar.get('/oauth/userinfo', {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  expect(userInfo.ok()).toBe(true);
  expect(await userInfo.json()).toMatchObject({ email: ADMIN_EMAIL });

  // 7. Cleanup while the session is still alive: disable the throwaway client
  // (there's no delete-client endpoint, only status transitions).
  const disableClient = await jar.post(
    `/admin/api/clients/${client.id}/status`,
    {
      headers: { 'x-csrf-token': adminCsrfToken },
      data: { status: 'disabled' },
    },
  );
  expect(disableClient.ok()).toBe(true);

  // 8. RP-initiated logout, hinted with the id_token we just received.
  const endSession = await jar.get('/oauth/end-session', {
    params: { id_token_hint: tokens.id_token ?? '' },
    maxRedirects: 0,
  });
  expect(endSession.status()).toBe(302);

  // 9. The provider session is actually gone, not just redirected away from.
  const postLogoutSession = await jar.get('/admin/api/session');
  expect(postLogoutSession.status()).toBe(401);
});
