import { getCsrfToken, setCsrfToken } from './api-client';
import { hardNavigate } from './navigation';

// Ends the provider session and leaves the SPA. POSTs to the provider-owned
// `/logout` (which revokes the session, signs out of Better Auth, and clears
// the session + CSRF cookies), then hard-navigates to `/login`. The backend
// does not require a CSRF token for logout, but we send it when present.
export async function performLogout(): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getCsrfToken();

  if (token) {
    headers['x-csrf-token'] = token;
  }

  try {
    // `redirect: 'manual'` keeps us from fetching the /login HTML; the browser
    // still applies the cookie-clearing Set-Cookie headers from the response.
    await fetch(new URL('/logout', window.location.origin), {
      method: 'POST',
      credentials: 'include',
      redirect: 'manual',
      headers,
    });
  } catch {
    // Ignore network failures; still drop client state and leave the app.
  }

  setCsrfToken(null);
  hardNavigate('/admin/login');
}
