import { describe, expect, it, vi } from 'vitest';
import { SecurityHeadersMiddleware } from './security-headers.middleware';

describe('SecurityHeadersMiddleware', () => {
  function cspFor(originalUrl: string): string {
    const headers = new Map<string, string>();
    const setHeader = vi.fn((key: string, value: string) =>
      headers.set(key, value),
    );
    const next = vi.fn();

    // Nest strips req.path to '/' under forRoutes('*'); the middleware must
    // classify from req.originalUrl.
    new SecurityHeadersMiddleware().use(
      { path: '/', originalUrl } as never,
      { setHeader } as never,
      next,
    );

    expect(next).toHaveBeenCalledOnce();

    return headers.get('content-security-policy') ?? '';
  }

  it('sets strict browser security headers', () => {
    const setHeader = vi.fn();
    const next = vi.fn();
    const middleware = new SecurityHeadersMiddleware();

    middleware.use({} as never, { setHeader } as never, next);

    expect(setHeader).toHaveBeenCalledWith('x-content-type-options', 'nosniff');
    expect(setHeader).toHaveBeenCalledWith('referrer-policy', 'no-referrer');
    expect(setHeader).toHaveBeenCalledWith('x-frame-options', 'DENY');
    expect(setHeader).toHaveBeenCalledWith(
      'strict-transport-security',
      'max-age=31536000; includeSubDomains',
    );
    expect(setHeader).toHaveBeenCalledWith(
      'content-security-policy',
      expect.stringContaining("frame-ancestors 'none'"),
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('forbids scripts on non-admin (SSR) routes', () => {
    const csp = cspFor('/login');

    expect(csp).toContain("script-src 'none'");
  });

  it('allows same-origin scripts for the admin SPA routes', () => {
    for (const path of ['/admin', '/admin/', '/admin/users/usr_1?x=1']) {
      const csp = cspFor(path);

      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toContain("script-src 'none'");
      expect(csp).toContain("img-src 'self' data:");
    }
  });
});
