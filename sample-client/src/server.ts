import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import {
  buildAuthorizationRequest,
  buildClearedSessionCookieHeader,
  buildEndSessionUrl,
  buildSessionCookieHeader,
  createLocalSession,
  exchangeAuthorizationCode,
  parseCookies,
  parseLocalSession,
  revokeRefreshToken,
  validateIdToken,
  type DiscoveryDocument,
  type JsonWebKeySet,
  type LocalSession,
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
          idToken: tokenResponse.id_token,
          accessToken: tokenResponse.access_token,
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
      const session = parseLocalSession(
        parseCookies(req.headers.cookie)[sessionCookieName],
        config.sessionSecret,
      );

      if (!session) {
        res.writeHead(303, { location: '/' });
        res.end();
        return;
      }

      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderProviderLogout());
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/provider-logout') {
      const session = parseLocalSession(
        parseCookies(req.headers.cookie)[sessionCookieName],
        config.sessionSecret,
      );

      if (!session) {
        res.writeHead(303, { location: '/' });
        res.end();
        return;
      }

      // Clears the local session and hands off to the provider's own logout,
      // since this app's "signed in" state is stale the moment either one ends.
      res.writeHead(303, {
        location: buildEndSessionUrl(discovery, config, session.idToken),
        'set-cookie': buildClearedSessionCookieHeader(sessionCookieName),
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/logout/callback') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderLoggedOut());
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

const STYLE = `
  body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 640px; margin: 3rem auto; padding: 0 1.5rem; color: #181a1f; background: #f7f8fa; }
  h1 { font-size: 1.4rem; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1.25rem 1.5rem; margin: 1.25rem 0; }
  dt { font-weight: 600; font-size: 0.8rem; color: #6b7280; margin-top: 0.75rem; }
  dd { margin: 0.15rem 0 0; font-family: ui-monospace, monospace; font-size: 0.85rem; word-break: break-all; }
  pre { background: #f3f4f6; padding: 0.75rem; border-radius: 6px; overflow-x: auto; font-size: 0.8rem; }
  button, .button { display: inline-block; background: #4b7fe0; color: #fff; border: none; border-radius: 8px; padding: 0.55rem 1rem; font-size: 0.9rem; cursor: pointer; text-decoration: none; }
  button.secondary, .button.secondary { background: #fff; color: #181a1f; border: 1px solid #d1d5db; }
  form { display: inline-block; margin: 0.25rem 0.5rem 0.25rem 0; }
  .actions { margin-top: 1rem; }
`;

function renderPage(title: string, body: string): string {
  return [
    '<!doctype html>',
    '<html><head>',
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STYLE}</style>`,
    '</head><body>',
    `<h1>Internal ID Sample Client</h1>`,
    body,
    '</body></html>',
  ].join('');
}

function renderHome(session: LocalSession | null): string {
  if (!session) {
    return renderPage(
      'Internal ID Sample Client',
      [
        '<div class="card">',
        '<p>No local app session exists.</p>',
        '<a class="button" href="/login">Sign in with Internal ID</a>',
        '</div>',
      ].join(''),
    );
  }

  const claims = decodeJwtPayload(session.idToken);

  return renderPage(
    'Internal ID Sample Client',
    [
      '<div class="card">',
      `<p>Signed in as <strong>${escapeHtml(session.email ?? session.sub)}</strong></p>`,
      '<dl>',
      `<dt>Subject</dt><dd>${escapeHtml(session.sub)}</dd>`,
      `<dt>Name</dt><dd>${escapeHtml(session.name ?? '(not requested)')}</dd>`,
      `<dt>Refresh token</dt><dd>${session.refreshToken ? 'issued' : 'not issued (add offline_access to request one)'}</dd>`,
      `<dt>Access token</dt><dd>${escapeHtml(session.accessToken)}</dd>`,
      '</dl>',
      '<dt style="font-family: ui-sans-serif, system-ui, sans-serif;">Decoded ID token claims</dt>',
      `<pre>${escapeHtml(JSON.stringify(claims, null, 2))}</pre>`,
      '</div>',
      '<div class="actions">',
      '<form method="post" action="/logout"><button type="submit" class="secondary">App logout</button></form>',
      '<a class="button" href="/provider-logout">Provider logout (RP-initiated)</a>',
      '</div>',
    ].join(''),
  );
}

function renderProviderLogout(): string {
  return renderPage(
    'Provider logout',
    [
      '<div class="card">',
      "<p>This clears this app's local session, then redirects to Internal ID's",
      ' <code>/oauth/end-session</code> endpoint (OIDC RP-Initiated Logout) to end',
      ' the provider session too, hinted with your current ID token.</p>',
      '<form method="post" action="/provider-logout">',
      '<button type="submit">Continue to provider logout</button>',
      '</form>',
      ' <a class="button secondary" href="/">Cancel</a>',
      '</div>',
    ].join(''),
  );
}

function renderLoggedOut(): string {
  return renderPage(
    'Logged out',
    [
      '<div class="card">',
      "<p>You have been logged out of Internal ID. This app's local session was",
      ' already cleared before the redirect here.</p>',
      '<a class="button" href="/">Return home</a>',
      '</div>',
    ].join(''),
  );
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');

  return JSON.parse(
    Buffer.from(payload ?? '', 'base64url').toString('utf8'),
  ) as Record<string, unknown>;
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
