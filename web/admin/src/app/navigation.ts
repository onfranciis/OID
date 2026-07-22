export const LOGIN_PATH = '/admin/login';

export function hardNavigate(url: string): void {
  window.location.assign(url);
}

export function loginUrl(returnTo: string): string {
  return `${LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}`;
}
