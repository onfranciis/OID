import { getCsrfToken, setCsrfToken } from './api-client';
import { hardNavigate, LOGIN_PATH } from './navigation';

export async function performLogout(): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getCsrfToken();

  if (token) {
    headers['x-csrf-token'] = token;
  }

  try {
    await fetch(new URL('/logout', window.location.origin), {
      method: 'POST',
      credentials: 'include',
      redirect: 'manual',
      headers,
    });
  } catch {
    // Still drop client state and leave even if the request failed.
  }

  setCsrfToken(null);
  hardNavigate(LOGIN_PATH);
}
