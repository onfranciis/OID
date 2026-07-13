// Full-page navigation lives here (instead of inline window.location calls) so
// the session boundary stays testable: tests mock this module.

export function hardNavigate(url: string): void {
  window.location.assign(url);
}

export function loginUrl(returnTo: string): string {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}
