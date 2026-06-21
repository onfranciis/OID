import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import {
  buildAuthorizationRequest,
  buildClearedSessionCookieHeader,
  buildSessionCookieHeader,
  createLocalSession,
  exchangeAuthorizationCode,
  parseCookies,
  parseLocalSession,
  revokeRefreshToken,
  validateIdToken,
  type DiscoveryDocument,
  type JsonWebKeySet,
  type SampleClientConfig,
} from './oidc-client';

const appPort = Number.parseInt(process.env.SAMPLE_CLIENT_PORT ?? '4000', 10);
const sessionCookieName =
  process.env.SAMPLE_CLIENT_SESSION_COOKIE_NAME ?? 'sample_client_session';
const sessionTtlSeconds = 60 * 60;
const config: SampleClientConfig = {
  issuer: process.env.INTERNAL_ID_ISSUER ?? 'http://localhost:3000',
  clientId: process.env.SAMPLE_CLIENT_ID ?? 'internal-id-sample-client',
  clientSecret:
    process.env.SAMPLE_CLIENT_SECRET ?? 'replace-this-sample-client-secret',
  redirectUri:
    process.env.SAMPLE_CLIENT_REDIRECT_URI ??
    'http://localhost:4000/auth/callback',
  postLogoutRedirectUri:
    process.env.SAMPLE_CLIENT_POST_LOGOUT_REDIRECT_URI ??
    'http://localhost:4000/logout/callback',
  scope: process.env.SAMPLE_CLIENT_SCOPE ?? 'openid profile email',
  sessionSecret:
    process.env.SAMPLE_CLIENT_SESSION_SECRET ??
    'development-only-sample-session-secret-change-me',
};
const authorizationRequests = new Map<
  string,
  {
    nonce: string;
    codeVerifier: string;
  }
>();

async function main(): Promise<void> {
  const discovery = await fetchJson<DiscoveryDocument>(
    `${config.issuer}/.well-known/openid-configuration`,
  );
  const jwks = await fetchJson<JsonWebKeySet>(discovery.jwks_uri);

  createServer((req, res) => {
    void handleRequest(req, res, discovery, jwks);
  }).listen(appPort, () => {
    console.log(`Sample client listening on http://localhost:${appPort}`);
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  discovery: DiscoveryDocument,
  jwks: JsonWebKeySet,
): Promise<void> {
  try {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (req.method === 'GET' && requestUrl.pathname === '/') {
      const session = parseLocalSession(
        parseCookies(req.headers.cookie)[sessionCookieName],
        config.sessionSecret,
      );

      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderHome(session));
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/login') {
      const authorizationRequest = buildAuthorizationRequest(discovery, config);
      authorizationRequests.set(authorizationRequest.state, {
        nonce: authorizationRequest.nonce,
        codeVerifier: authorizationRequest.codeVerifier,
      });
      res.writeHead(303, { location: authorizationRequest.redirectTo });
      res.end();
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/auth/callback') {
      const state = requestUrl.searchParams.get('state') ?? '';
      const code = requestUrl.searchParams.get('code') ?? '';
      const pendingRequest = authorizationRequests.get(state);
      authorizationRequests.delete(state);

      if (!pendingRequest || !code) {
        throw new Error('Invalid callback state or code.');
      }

      const tokenResponse = await exchangeAuthorizationCode(discovery, config, {
        code,
        codeVerifier: pendingRequest.codeVerifier,
      });
      const claims = validateIdToken({
        idToken: tokenResponse.id_token,
        jwks,
        issuer: discovery.issuer,
        clientId: config.clientId,
        nonce: pendingRequest.nonce,
      });
      const sessionValue = createLocalSession(
        {
          sub: claims.sub,
          email: claims.email,
          name: claims.name,
          refreshToken: tokenResponse.refresh_token,
          expiresAt: Math.floor(Date.now() / 1000) + sessionTtlSeconds,
        },
        config.sessionSecret,
      );

      res.writeHead(303, {
        location: '/',
        'set-cookie': buildSessionCookieHeader(
          sessionCookieName,
          sessionValue,
          sessionTtlSeconds,
        ),
      });
      res.end();
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/logout') {
      const session = parseLocalSession(
        parseCookies(req.headers.cookie)[sessionCookieName],
        config.sessionSecret,
      );

      await revokeRefreshToken(discovery, session?.refreshToken);
      res.writeHead(303, {
        location: '/',
        'set-cookie': buildClearedSessionCookieHeader(sessionCookieName),
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/provider-logout') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderProviderLogout(discovery.issuer));
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(error instanceof Error ? error.message : 'Unexpected error');
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`GET ${url} failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as T;
}

function renderHome(session: ReturnType<typeof parseLocalSession>): string {
  if (!session) {
    return [
      '<!doctype html>',
      '<html><body>',
      '<h1>Internal ID Sample Client</h1>',
      '<p>No local app session exists.</p>',
      '<a href="/login">Sign in with Internal ID</a>',
      '</body></html>',
    ].join('');
  }

  return [
    '<!doctype html>',
    '<html><body>',
    '<h1>Internal ID Sample Client</h1>',
    `<p>Signed in as ${escapeHtml(session.email ?? session.sub)}</p>`,
    '<form method="post" action="/logout"><button type="submit">App logout</button></form>',
    '<p><a href="/provider-logout">Provider logout form</a></p>',
    '</body></html>',
  ].join('');
}

function renderProviderLogout(issuer: string): string {
  return [
    '<!doctype html>',
    '<html><body>',
    '<h1>Provider logout</h1>',
    '<p>This posts to Internal ID and clears the provider session.</p>',
    `<form method="post" action="${escapeHtml(issuer)}/logout">`,
    '<button type="submit">Logout from provider</button>',
    '</form>',
    '</body></html>',
  ].join('');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
