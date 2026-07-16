// Full-page navigation lives here (instead of inline window.location calls) so
// the session boundary and API client stay testable: tests mock this module.

// The provider-owned login page. Anytime the session no longer exists, the UI
// sends the user here.
export const LOGIN_PATH = '/admin/login';

export function hardNavigate(url: string): void {
  window.location.assign(url);
}

export function loginUrl(returnTo: string): string {
  return `${LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}`;
}
