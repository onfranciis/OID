export const LOGIN_PATH = '/admin/login';
export const FORGOT_PASSWORD_PATH = '/admin/forgot-password';

export function hardNavigate(url: string): void {
  window.location.assign(url);
}

export function loginUrl(returnTo: string): string {
  return `${LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}`;
}
