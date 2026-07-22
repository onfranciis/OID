export const LOGIN_PATH = '/admin/login';
export const FORGOT_PASSWORD_PATH = '/admin/forgot-password';

// Presence of this param tells LoginPage to force the sign-in form even if a
// session already exists — used by the re-auth flow, where an existing
// session is exactly what's too stale and needs replacing.
export const REAUTH_PARAM = 'reauth';

export function hardNavigate(url: string): void {
  window.location.assign(url);
}

export function loginUrl(
  returnTo: string,
  options?: { forceReauth?: boolean },
): string {
  const params = new URLSearchParams({ returnTo });

  if (options?.forceReauth) {
    params.set(REAUTH_PARAM, '1');
  }

  return `${LOGIN_PATH}?${params.toString()}`;
}
