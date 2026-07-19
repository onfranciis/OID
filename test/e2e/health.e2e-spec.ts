import { expect, test } from '@playwright/test';

// Runs unconditionally against baseURL (no auth/seed required) — the one
// sanity check that the live server this whole e2e suite targets is actually
// up before the rest of the suite (oidc-protocol.e2e-spec.ts) tries anything
// that needs a seeded database.

test('health endpoint reports the database as connected', async ({
  request,
}) => {
  const response = await request.get('/health');

  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    service: 'internal-id',
    status: 'ok',
    database: 'up',
  });
});

test('discovery document advertises the live OIDC endpoints', async ({
  request,
  baseURL,
}) => {
  const response = await request.get('/.well-known/openid-configuration');

  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    issuer: baseURL,
    authorization_endpoint: `${baseURL}/oauth/authorize`,
    token_endpoint: `${baseURL}/oauth/token`,
    end_session_endpoint: `${baseURL}/oauth/end-session`,
    userinfo_endpoint: `${baseURL}/oauth/userinfo`,
  });
});

test('JWKS exposes at least one signing key', async ({ request }) => {
  const response = await request.get('/.well-known/jwks.json');

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { keys: unknown[] };
  expect(Array.isArray(body.keys)).toBe(true);
  expect(body.keys.length).toBeGreaterThan(0);
});
