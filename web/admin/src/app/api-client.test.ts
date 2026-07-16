import { http, HttpResponse } from 'msw';
import { afterEach, expect, test, vi } from 'vitest';
import { server } from '../mocks/server';
import {
  ApiError,
  apiGet,
  apiPost,
  isForbiddenError,
  isRecentAuthError,
  isUnauthorizedError,
  setCsrfToken,
} from './api-client';
import { hardNavigate } from './navigation';

vi.mock('./navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./navigation')>();

  return { ...actual, hardNavigate: vi.fn() };
});

afterEach(() => setCsrfToken(null));

test('a 401 redirects the whole UI to the login page', async () => {
  server.use(
    http.get('/admin/api/probe', () =>
      HttpResponse.json(
        {
          statusCode: 401,
          message: 'Admin authentication required.',
          error: 'Unauthorized',
        },
        { status: 401 },
      ),
    ),
  );

  await expect(apiGet('/admin/api/probe')).rejects.toBeInstanceOf(ApiError);
  expect(vi.mocked(hardNavigate)).toHaveBeenCalledWith(
    '/admin/login?returnTo=%2Fadmin',
  );
});

test('GET requests send credentials and no CSRF header', async () => {
  let sawCsrf: string | null = 'unset';
  let credentials: RequestCredentials | undefined;

  server.use(
    http.get('/admin/api/probe', ({ request }) => {
      sawCsrf = request.headers.get('x-csrf-token');
      credentials = request.credentials;

      return HttpResponse.json({ ok: true });
    }),
  );

  setCsrfToken('nonce.sig');
  await apiGet('/admin/api/probe');

  expect(sawCsrf).toBeNull();
  expect(credentials).toBe('include');
});

test('POST requests attach the CSRF token when set', async () => {
  let sawCsrf: string | null = null;

  server.use(
    http.post('/admin/api/probe', ({ request }) => {
      sawCsrf = request.headers.get('x-csrf-token');

      return HttpResponse.json({ ok: true });
    }),
  );

  setCsrfToken('nonce.sig');
  await apiPost('/admin/api/probe', { value: 1 });

  expect(sawCsrf).toBe('nonce.sig');
});

test('string error envelope maps to ApiError.message', async () => {
  server.use(
    http.get('/admin/api/probe', () =>
      HttpResponse.json(
        { statusCode: 404, message: 'User not found.', error: 'Not Found' },
        { status: 404 },
      ),
    ),
  );

  await expect(apiGet('/admin/api/probe')).rejects.toMatchObject({
    statusCode: 404,
    message: 'User not found.',
  });
});

test('array error envelope keeps all messages, first as message', async () => {
  server.use(
    http.post('/admin/api/probe', () =>
      HttpResponse.json(
        {
          statusCode: 400,
          message: ['email is required.', 'name is required.'],
          error: 'Bad Request',
        },
        { status: 400 },
      ),
    ),
  );

  try {
    await apiPost('/admin/api/probe');
    throw new Error('expected rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.message).toBe('email is required.');
    expect(apiError.messages).toHaveLength(2);
  }
});

test('status discriminators classify errors correctly', () => {
  const unauthorized = new ApiError(401, ['x'], 'x');
  const forbidden = new ApiError(403, ['Invalid CSRF token.'], 'x');
  const recentAuth = new ApiError(
    403,
    ['Recent admin authentication required.'],
    'x',
  );

  expect(isUnauthorizedError(unauthorized)).toBe(true);
  expect(isForbiddenError(forbidden)).toBe(true);
  expect(isRecentAuthError(forbidden)).toBe(false);
  expect(isRecentAuthError(recentAuth)).toBe(true);
  expect(isUnauthorizedError(new Error('plain'))).toBe(false);
});
