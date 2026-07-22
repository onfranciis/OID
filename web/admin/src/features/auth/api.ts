// Uses dedicated fetch calls, not the shared api-client, so a 401 here shows
// as an inline error instead of triggering the app-wide login redirect.

export interface LoginInit {
  csrfToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
  csrfToken: string;
  returnTo: string;
}

export class LoginError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'LoginError';
    this.status = status;
  }
}

function authUrl(path: string): URL {
  return new URL(path, window.location.origin);
}

export async function initLogin(): Promise<LoginInit> {
  const response = await fetch(authUrl('/admin/api/auth/login'), {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new LoginError(
      'Could not start sign-in. Please reload.',
      response.status,
    );
  }

  return (await response.json()) as LoginInit;
}

export async function submitLogin(
  input: LoginInput,
): Promise<{ redirectTo: string }> {
  const response = await fetch(authUrl('/admin/api/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(input),
  });

  const data: unknown = response.headers
    .get('content-type')
    ?.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new LoginError(
      pickMessage(data) ?? 'Sign-in failed. Please try again.',
      response.status,
    );
  }

  return data as { redirectTo: string };
}

export class PasswordResetError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PasswordResetError';
    this.status = status;
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await fetch(authUrl('/admin/api/auth/forgot-password'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function getPasswordReset(
  token: string,
): Promise<{ email: string }> {
  const response = await fetch(
    authUrl(`/admin/api/auth/password-reset/${encodeURIComponent(token)}`),
    {
      credentials: 'include',
      headers: { accept: 'application/json' },
    },
  );

  const data: unknown = response.headers
    .get('content-type')
    ?.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new PasswordResetError(
      pickMessage(data) ?? 'This reset link is invalid or has expired.',
      response.status,
    );
  }

  return data as { email: string };
}

export async function confirmPasswordReset(
  token: string,
  password: string,
): Promise<void> {
  const response = await fetch(
    authUrl(`/admin/api/auth/password-reset/${encodeURIComponent(token)}`),
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ password }),
    },
  );

  if (!response.ok) {
    const data: unknown = response.headers
      .get('content-type')
      ?.includes('application/json')
      ? await response.json()
      : null;

    throw new PasswordResetError(
      pickMessage(data) ?? 'Could not set your password. Please try again.',
      response.status,
    );
  }
}

function pickMessage(data: unknown): string | null {
  if (data !== null && typeof data === 'object' && 'message' in data) {
    const message = data.message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message) && typeof message[0] === 'string') {
      return message[0];
    }
  }

  return null;
}

// Only allow same-origin, non-protocol-relative return paths (avoids open
// redirects); anything else falls back to the admin home.
export function safeReturnTo(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }

  return '/admin';
}
