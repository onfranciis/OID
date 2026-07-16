// Typed fetch wrapper for /admin/api/*.
//
// - Sends cookies (`credentials: 'include'`); the provider session cookie is
//   HttpOnly and never touched by this code.
// - Attaches the double-submit CSRF token as `x-csrf-token` on mutations. The
//   token comes from the session bootstrap (GET /admin/api/session) because the
//   CSRF cookie itself is HttpOnly.
// - Maps the NestJS error envelope `{ statusCode, message, error }` to ApiError.
// - Redirects the whole UI to login whenever a request answers 401 (the session
//   no longer exists), so a session lost mid-use never leaves the app stranded.

import { hardNavigate, loginUrl } from './navigation';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly messages: string[];

  constructor(statusCode: number, messages: string[], fallbackMessage: string) {
    super(messages[0] ?? fallbackMessage);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.messages = messages.length > 0 ? messages : [fallbackMessage];
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 401;
}

// Once the session no longer exists, every /admin/api/* call answers 401. We
// redirect the whole UI to the provider login exactly once (a second call while
// the page is already unloading would be wasted).
let redirectingToLogin = false;

export function redirectToLogin(returnTo = '/admin'): void {
  if (redirectingToLogin) {
    return;
  }

  redirectingToLogin = true;
  hardNavigate(loginUrl(returnTo));
}

// Test-only: reset the one-shot guard between cases.
export function resetLoginRedirect(): void {
  redirectingToLogin = false;
}

export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 403;
}

// AdminRecentAuthGuard rejects with exactly this message; it is how the UI
// distinguishes the recent-auth gate from other 403s (CSRF, access denied).
export function isRecentAuthError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.statusCode === 403 &&
    error.messages.some((message) =>
      message.toLowerCase().includes('recent admin authentication'),
    )
  );
}

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const init: RequestInit = { method, credentials: 'include', headers };

  if (method !== 'GET') {
    headers['content-type'] = 'application/json';
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
  }

  const response = await fetch(new URL(path, window.location.origin), init);
  const contentType = response.headers.get('content-type') ?? '';
  const data: unknown = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    if (response.status === 401) {
      redirectToLogin();
    }

    throw new ApiError(
      response.status,
      normalizeMessages(data),
      `Request failed with status ${response.status}.`,
    );
  }

  return data as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

function normalizeMessages(body: unknown): string[] {
  if (body !== null && typeof body === 'object' && 'message' in body) {
    const raw = body.message;

    if (typeof raw === 'string') {
      return [raw];
    }

    if (Array.isArray(raw)) {
      return raw.filter((value): value is string => typeof value === 'string');
    }
  }

  return [];
}
