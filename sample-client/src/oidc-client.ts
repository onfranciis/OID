import {
  createHash,
  createHmac,
  createPublicKey,
  createVerify,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint?: string;
  end_session_endpoint?: string;
  jwks_uri: string;
}

export interface JsonWebKeySet {
  keys: Array<Record<string, unknown>>;
}

export interface SampleClientConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope: string;
  sessionSecret: string;
}

export interface AuthorizationRequest {
  redirectTo: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  id_token: string;
  refresh_token?: string;
  scope: string;
}

export interface ValidatedIdTokenClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  iat: number;
  nonce: string;
  email?: string;
  name?: string;
}

export interface LocalSession {
  sub: string;
  email?: string;
  name?: string;
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export function buildAuthorizationRequest(
  discovery: DiscoveryDocument,
  config: SampleClientConfig,
): AuthorizationRequest {
  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken(64);
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  const authorizationUrl = new URL(discovery.authorization_endpoint);

  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', config.clientId);
  authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizationUrl.searchParams.set('scope', config.scope);
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('nonce', nonce);
  authorizationUrl.searchParams.set('code_challenge', codeChallenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');

  return {
    redirectTo: authorizationUrl.toString(),
    state,
    nonce,
    codeVerifier,
  };
}

export async function exchangeAuthorizationCode(
  discovery: DiscoveryDocument,
  config: SampleClientConfig,
  input: {
    code: string;
    codeVerifier: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: input.codeVerifier,
  });
  const response = await fetchImpl(discovery.token_endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as TokenResponse;
}

// OIDC RP-Initiated Logout 1.0: hints the provider at who is logging out and
// where to send the browser back to afterward. The provider only honors
// post_logout_redirect_uri when it's registered for this client_id (see
// docs/CLIENT_INTEGRATION.md) — an unregistered one is silently ignored in
// favor of the provider's own login page, never followed blindly.
export function buildEndSessionUrl(
  discovery: DiscoveryDocument,
  config: SampleClientConfig,
  idTokenHint: string,
): string {
  if (!discovery.end_session_endpoint) {
    throw new Error('Provider does not advertise an end_session_endpoint.');
  }

  const url = new URL(discovery.end_session_endpoint);

  url.searchParams.set('id_token_hint', idTokenHint);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set(
    'post_logout_redirect_uri',
    config.postLogoutRedirectUri,
  );

  return url.toString();
}

export async function revokeRefreshToken(
  discovery: DiscoveryDocument,
  refreshToken: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!refreshToken || !discovery.revocation_endpoint) {
    return;
  }

  await fetchImpl(discovery.revocation_endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      token: refreshToken,
    }),
  });
}

export function validateIdToken(input: {
  idToken: string;
  jwks: JsonWebKeySet;
  issuer: string;
  clientId: string;
  nonce: string;
  now?: Date;
}): ValidatedIdTokenClaims {
  const [encodedHeader, encodedPayload, encodedSignature] =
    input.idToken.split('.');

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('ID token must be a compact JWT.');
  }

  const header = parseBase64UrlJson(encodedHeader);
  const payload = parseBase64UrlJson(encodedPayload);

  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new Error('ID token must use an RS256 signing key.');
  }

  const publicJwk = input.jwks.keys.find((key) => key.kid === header.kid);

  if (!publicJwk) {
    throw new Error('ID token signing key is not in JWKS.');
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);

  if (
    !verifier.verify(
      createPublicKey({ key: publicJwk, format: 'jwk' }),
      encodedSignature,
      'base64url',
    )
  ) {
    throw new Error('ID token signature is invalid.');
  }

  assertClaim(payload.iss === input.issuer, 'ID token issuer is invalid.');
  assertClaim(
    audienceIncludes(payload.aud, input.clientId),
    'ID token audience is invalid.',
  );
  assertClaim(payload.nonce === input.nonce, 'ID token nonce is invalid.');
  assertClaim(typeof payload.sub === 'string', 'ID token subject is missing.');
  assertClaim(typeof payload.iat === 'number', 'ID token iat is missing.');
  assertClaim(typeof payload.exp === 'number', 'ID token exp is missing.');

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);

  assertClaim(payload.exp > nowSeconds, 'ID token is expired.');

  return payload as unknown as ValidatedIdTokenClaims;
}

export function createLocalSession(
  session: LocalSession,
  secret: string,
): string {
  const payload = Buffer.from(JSON.stringify(session), 'utf8').toString(
    'base64url',
  );
  const signature = sign(payload, secret);

  return `${payload}.${signature}`;
}

export function parseLocalSession(
  value: string | undefined,
  secret: string,
  now: Date = new Date(),
): LocalSession | null {
  const [payload, signature] = value?.split('.') ?? [];

  if (!payload || !signature) {
    return null;
  }

  if (!safeEqual(signature, sign(payload, secret))) {
    return null;
  }

  const session = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as LocalSession;

  if (session.expiresAt <= Math.floor(now.getTime() / 1000)) {
    return null;
  }

  return session;
}

export function buildSessionCookieHeader(
  name: string,
  value: string,
  maxAgeSeconds: number,
): string {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function buildClearedSessionCookieHeader(name: string): string {
  return `${name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function parseCookies(
  headerValue: string | undefined,
): Record<string, string> {
  if (!headerValue) {
    return {};
  }

  return Object.fromEntries(
    headerValue
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => {
        const separatorIndex = part.indexOf('=');

        if (separatorIndex === -1) {
          return [part, ''];
        }

        return [
          part.slice(0, separatorIndex),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ];
      }),
  );
}

function randomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

function parseBase64UrlJson(value: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}

function audienceIncludes(audience: unknown, clientId: string): boolean {
  return (
    audience === clientId ||
    (Array.isArray(audience) && audience.includes(clientId))
  );
}

function assertClaim(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
